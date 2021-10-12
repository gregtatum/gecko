/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var PineBuildUIUtils = {
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
};
