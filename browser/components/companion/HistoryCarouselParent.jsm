/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["HistoryCarousel", "HistoryCarouselParent"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "CLICK_COUNT_TIMEOUT_MS",
  "browser.pinebuild.megaback.click-count-timeout-ms",
  3000
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "CLICK_COUNT_THRESHOLD",
  "browser.pinebuild.megaback.click-count-threshold",
  5
);

/**
 * The HistoryCarousel class is responsible for interpreting whether or not
 * the user has interacted with the back button in a way that indicates
 * that they want to show the history carousel. Currently, there are
 * two interactions that do this:
 *
 * 1. A long-press on the back button
 * 2. Frequent clicks on the back button within a time period. Currently,
 *    that's CLICK_COUNT_THRESHOLD clicks during a
 *    CLICK_COUNT_TIMEOUT_MS period.
 */
class HistoryCarousel {
  #timerID;
  #clickCount;
  #openedByLongPress;
  #window;

  /**
   * Sets up the event handlers on the back button.
   */
  constructor(window) {
    this.#timerID = null;
    this.#clickCount = 0;
    this.#openedByLongPress = false;
    this.#window = window;
  }

  init() {
    if (
      !Services.prefs.getBoolPref("browser.pinebuild.megaback.enabled", false)
    ) {
      return;
    }
    let doc = this.#window.document;
    let pbBackButton = doc.getElementById("pinebuild-back-button");

    // We need to add this capturing click event handler before adding
    // to the gClickAndHoldListenersOnElement to ensure the click event
    // handler is called first. That gives us an opportunity to cancel
    // the back button click command from running if the user long
    // presses on the back button.
    pbBackButton.addEventListener("click", this, { capture: true });

    this.#window.gClickAndHoldListenersOnElement.add(pbBackButton, () => {
      // The user longpressed, so set this flag to prevent the back
      // command from being fired on click.
      this._openedByLongPress = true;
      this.#window.gGlobalHistory.showHistoryCarousel(true);
    });
  }

  handleEvent(event) {
    if (event.type != "click") {
      return;
    }
    // This is kind of a hack, but if this flag is set, then we
    // prevent the click event from continuing to propagate, and
    // call preventDefault. This prevents both the
    // gClickAndHoldListenersOnElement command and the default
    // XUL command machinery from firing. We then clear the flag
    // to make sure that clicks continue to work.
    if (this.#openedByLongPress) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.#openedByLongPress = false;
      return;
    }

    if (!this.#timerID) {
      this.#clickCount = 1;
      this.#timerID = this.#window.setTimeout(() => {
        this.resetCount();
      }, CLICK_COUNT_TIMEOUT_MS);
    } else {
      this.#clickCount++;
      if (this.#clickCount >= CLICK_COUNT_THRESHOLD) {
        this.#window.clearTimeout(this._timerID);
        this.resetCount();
        this.#window.gGlobalHistory.showHistoryCarousel(true);
      }
    }
  }

  /**
   * Rests the tracked number of clicks on the back button back
   * to 0.
   */
  resetCount() {
    this.#clickCount = 0;
    this.#timerID = null;
  }
}

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
