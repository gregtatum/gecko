/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["HistoryCarouselParent"];

/**
 * HistoryCarouselParent acts as a mediator between an about:historycarousel
 * page and the GlobalHistory instance in the associated window.
 */
class HistoryCarouselParent extends JSWindowActorParent {
  // We hold a reference to GlobalHistory because accessing the browsingContext
  // embedderElement won't work in didDestroy.
  #globalHistory;

  actorCreated() {
    let window = this.browsingContext.embedderElement.ownerGlobal;
    this.#globalHistory = window.gGlobalHistory;
    this.#globalHistory.addEventListener("ViewChanged", this);
  }

  didDestroy() {
    this.#globalHistory.removeEventListener("ViewChanged", this);
  }

  /**
   * Handles GlobalHistory ViewChanged events so that the carousel
   * can then select the appropriate index to match.
   *
   * @param {GlobalHistoryEvent} event
   *   The ViewChanged GlobalHistoryEvent indicating a change of
   *   View selection in the parent process.
   */
  handleEvent(event) {
    if (event.type == "ViewChanged") {
      let index = this.#globalHistory.views.indexOf(event.view);
      this.sendAsyncMessage("SelectIndex", { index });
    }
  }

  /**
   * Handles messages sent by the HistoryCarouselChild, and passes
   * them along to the GlobalHistory instance for the current window.
   *
   * @param {Object} message
   *   The message received from the HistoryCarouselChild.
   */
  async receiveMessage(message) {
    let browser = this.browsingContext.top.embedderElement;
    let window = browser.ownerGlobal;

    switch (message.name) {
      // The empty carousel has loaded, so we now populate it with enough
      // information to render the currently selected View.
      case "Init": {
        return this.#globalHistory.getInitialHistoryCarouselData();
      }
      // The currently selected View has had its image populated, meaning we're
      // ready to switch the carousel <browser> to the foreground. Dispatches a
      // custom HistoryCarousel:Ready event so that GlobalHistory can do the
      // switch.
      case "Ready": {
        browser.dispatchEvent(
          new window.CustomEvent("HistoryCarousel:Ready", {
            bubbles: true,
          })
        );
        break;
      }
      // The HistoryCarouselChild has requested preview image data for a
      // particular index.
      case "GetPreview": {
        return this.#globalHistory.getHistoryCarouselDataForIndex(
          message.data.index
        );
      }
      // The HistoryCarouselChild has received a user input event requesting
      // that it exit.
      case "RequestExit": {
        return this.#globalHistory.showHistoryCarousel(false);
      }
      // The selection inside of the carousel has changed.
      case "SetVisibleIndex": {
        this.#globalHistory.setHistoryCarouselIndex(message.data.index);
        break;
      }
    }

    return null;
  }
}
