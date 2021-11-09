/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["HistoryCarouselChild"];

/**
 * HistoryCarouselChild loads for about:historycarousel in the privileged
 * about content process, and asks as the communications hub to the parent
 * process for things necessary to render the carousel. Most of the logic
 * for actually rendering the carousel is in
 * historyCarousel.html / historyCarousel.js.
 */
class HistoryCarouselChild extends JSWindowActorChild {
  actorCreated() {
    this.previews = [];
    this.currentIndex = -1;
  }

  /**
   * Handler for the sole HistoryCarouselInit event that the actor
   * pair is registered for.
   *
   * @param {CustomEvent} event
   *   The custom HistoryCarouselInit event that is fired by
   *   historyCarousel.js after it finishes loading.
   */
  async handleEvent(event) {
    if (event.type != "HistoryCarouselInit") {
      return;
    }

    let win = this.browsingContext.window;
    let waivedContent = Cu.waiveXrays(win);
    let self = this;

    // CarouselUtils is a global exposed within the carousel UI to
    // do privileged communication with the parent process.
    let CarouselUtils = {
      getCurrentIndex() {
        return self.currentIndex;
      },
      getInitialPreviews() {
        return self.previews;
      },
      selectCurrentIndex(index) {
        self.currentIndex = index;
        self.sendAsyncMessage("SetVisibleIndex", { index });
      },
      requestExit() {
        self.sendAsyncMessage("RequestExit");
      },
      requestPreview(index) {
        return self.wrapPromise(
          new Promise(resolve => {
            self.sendQuery("GetPreview", { index }).then(result => {
              resolve(Cu.cloneInto(result, self.contentWindow));
            });
          })
        );
      },
    };

    waivedContent.CarouselUtils = Cu.cloneInto(CarouselUtils, waivedContent, {
      cloneFunctions: true,
    });

    let initData = await this.sendQuery("Init");
    this.previews = initData.previews;
    this.currentIndex = initData.currentIndex;
    this.sendMessageEvent("HistoryCarousel:Setup");

    this.sendAsyncMessage("Ready");
  }

  /**
   * A utility function that lets us reflect a Promise returned
   * from sendQuery back into a Promise that the underlying
   * contentWindow can handle.
   *
   * @param {Promise} promise
   *   A Promise from the current global.
   * @returns {Promise}
   *   A Promise that can be processed by the contentWindow global.
   */
  wrapPromise(promise) {
    return new this.contentWindow.Promise((resolve, reject) =>
      promise.then(resolve, reject)
    );
  }

  /**
   * Handler for messages or queries from the HistoryCarouselParent.
   *
   * @param {Object} message
   *   The message received from the HistoryCarouselParent.
   */
  async receiveMessage(message) {
    switch (message.name) {
      // The Exit message is sent when the parent has requested that the carousel
      // tear itself down.
      case "Exit": {
        this.document.body.setAttribute("exiting", "true");
        return new Promise(resolve => {
          this.document.body.addEventListener(
            "transitionend",
            () => {
              resolve(this.currentIndex);
            },
            { once: true }
          );
        });
      }
      // The SelectIndex message is sent when the parent has requested that the
      // current item in the carousel change.
      case "SelectIndex": {
        let index = message.data.index;
        if (index != this.currentIndex) {
          this.currentIndex = index;
          this.sendMessageEvent("HistoryCarousel:SelectCurrentIndex", {
            index,
          });
        }
        break;
      }
    }

    return null;
  }

  /**
   * Utility function for dispatching CustomEvents for communicating with
   * the underlying historyCarousel.js script.
   *
   * @param {String} messageType
   *   The type of CustomEvent to send to historyCarousel. By convention,
   *   these should start with "HistoryCarousel:".
   * @param {Object} detail
   *   Any detail items to be cloned and sent down with the event.
   */
  sendMessageEvent(messageType, detail) {
    let win = this.document.defaultView;
    let event = new win.CustomEvent(messageType, {
      detail: Cu.cloneInto(detail, win),
    });
    win.dispatchEvent(event);
  }
}
