/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env mozilla/browser-window */

var PineBuildUIUtils = {
  init() {
    window.addEventListener("deactivate", this);

    window.addEventListener(
      "unload",
      () => {
        // Clear any pending saves for this window on close, as it'll get
        // saved via the close window handlers.
        SessionManager.clearSessionSave(window);
        window.removeEventListener("deactivate", this);
      },
      { once: true }
    );
  },

  delayedStartup() {
    HistoryCarouselUI.init();
  },

  copy(anchor, string) {
    let clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
      Ci.nsIClipboardHelper
    );
    clipboard.copyString(string);
    anchor.ownerGlobal.ConfirmationHint.show(anchor, "copyURL");
  },

  closeCurrentView() {
    let gHistory = window.top.gGlobalHistory;
    gHistory.closeView(gHistory.currentView);
  },

  handleEvent(event) {
    switch (event.type) {
      case "deactivate": {
        if (!window.closed) {
          SessionManager.queueSessionSave(window);
        }
        break;
      }
    }
  },
};

PineBuildUIUtils.init();

/**
 * HistoryCarouselUI is responsible for interpreting whether or not
 * the user has interacted with the back button in a way that indicates
 * that they want to show the history carousel. Currently, there are
 * two interactions that do this:
 *
 * 1. A long-press on the back button
 * 2. Frequent clicks on the back button within a time period. Currently,
 *    that's CLICK_COUNT_THRESHOLD clicks during a
 *    CLICK_COUNT_TIMEOUT_MS period.
 */
var HistoryCarouselUI = {
  _timerID: null,
  _clickCount: 0,
  _openedByLongPress: false,

  /**
   * Sets up the event handlers on the back button.
   */
  init() {
    if (
      !Services.prefs.getBoolPref("browser.pinebuild.megaback.enabled", false)
    ) {
      return;
    }

    let pbBackButton = document.getElementById("pinebuild-back-button");

    // We need to add this capturing click event handler before adding
    // to the gClickAndHoldListenersOnElement to ensure the click event
    // handler is called first. That gives us an opportunity to cancel
    // the back button click command from running if the user long
    // presses on the back button.
    pbBackButton.addEventListener("click", this, { capture: true });

    gClickAndHoldListenersOnElement.add(pbBackButton, () => {
      // The user longpressed, so set this flag to prevent the back
      // command from being fired on click.
      this._openedByLongPress = true;
      gGlobalHistory.showHistoryCarousel(true);
    });

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
  },

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
    if (this._openedByLongPress) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this._openedByLongPress = false;
      return;
    }

    if (!this._timerID) {
      this._clickCount = 1;
      this._timerID = setTimeout(() => {
        this.resetCount();
      }, this.CLICK_COUNT_TIMEOUT_MS);
    } else {
      this._clickCount++;
      if (this._clickCount >= this.CLICK_COUNT_THRESHOLD) {
        clearTimeout(this._timerID);
        this.resetCount();
        gGlobalHistory.showHistoryCarousel(true);
      }
    }
  },

  /**
   * Rests the tracked number of clicks on the back button back
   * to 0.
   */
  resetCount() {
    this._clickCount = 0;
    this._timerID = null;
  },
};
