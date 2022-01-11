/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["FlowResetParent"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  SessionManager: "resource:///modules/SessionManager.jsm",
});

class FlowResetParent extends JSWindowActorParent {
  async receiveMessage(message) {
    let window = this.browsingContext.topChromeWindow;
    let browser = window.document.getElementById("companion-browser");
    let actor = browser?.browsingContext?.currentWindowGlobal?.getActor(
      "Companion"
    );
    switch (message.name) {
      case "ViewCompanionBrowseTab":
        let companion = window.document.getElementById("companion-box");
        if (!companion.isOpen) {
          companion.toggleVisible();
        }
        actor?.viewTab("browse");
        break;
      case "RestoreLastSession":
        await SessionManager.restoreLastSession(window);
        actor?.viewTab("now");
        break;
    }
  }
}
