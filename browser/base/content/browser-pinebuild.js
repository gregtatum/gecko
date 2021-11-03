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

  hideToolbar() {
    let companionToolbar = document.getElementById("pinebuild-toolbar");
    companionToolbar.hidden = true;
  },

  showToolbar() {
    let companionToolbar = document.getElementById("pinebuild-toolbar");
    companionToolbar.hidden = false;
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
