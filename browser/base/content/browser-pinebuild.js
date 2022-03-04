/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env mozilla/browser-window */

XPCOMUtils.defineLazyModuleGetters(this, {
  HistoryCarousel: "resource:///actors/HistoryCarouselParent.jsm",
});

XPCOMUtils.defineLazyGetter(this, "gHistoryCarousel", () => {
  return new HistoryCarousel(window);
});

var PineBuildUIUtils = {
  init() {
    window.addEventListener("deactivate", this);
    Services.els.addSystemEventListener(document, "keydown", this, false);

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
    window.top.gHistoryCarousel.init();
  },

  copy(anchor, string) {
    let clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
      Ci.nsIClipboardHelper
    );
    clipboard.copyString(string);
    anchor.ownerGlobal.ConfirmationHint.show(anchor, "copyURL");
  },

  handleEvent(event) {
    switch (event.type) {
      case "deactivate": {
        if (!window.closed) {
          SessionManager.queueSessionSave(window);
        }
        break;
      }
      case "keydown": {
        this.onKeyDown(event);
        break;
      }
    }
  },

  onKeyDown(event) {
    let action = ShortcutUtils.getSystemActionForEvent(event);
    switch (action) {
      case ShortcutUtils.CYCLE_TABS: {
        if (event.shiftKey) {
          gGlobalHistory.goBack();
        } else {
          gGlobalHistory.goForward();
        }
        event.preventDefault();
        break;
      }
      case ShortcutUtils.CLOSE_TAB: {
        gGlobalHistory.closeCurrentView();
        event.preventDefault();
        break;
      }
      case ShortcutUtils.NEXT_TAB: {
        gGlobalHistory.goForward();
        event.preventDefault();
        break;
      }
      case ShortcutUtils.PREVIOUS_TAB: {
        gGlobalHistory.goBack();
        event.preventDefault();
        break;
      }
    }
  },
};

PineBuildUIUtils.init();
