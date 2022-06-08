/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["FlowResetParent"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  CompanionParent: "resource:///actors/CompanionParent.jsm",
  SessionManager: "resource:///modules/SessionManager.jsm",
});

class FlowResetParent extends JSWindowActorParent {
  async receiveMessage(message) {
    let window = this.browsingContext.topChromeWindow;
    switch (message.name) {
      case "ViewCompanionBrowseTab":
        CompanionParent.openCompanionTab("browse");
        break;
      case "RestoreLastSession":
        SessionManager.restoreLastSession(window);
        break;
      case "FlowResetLoaded":
        if (window && !window.closed) {
          window.gURLBar.focus();
        }
        break;
      case "HasSession":
        // This query includes page data as that has additional checks to
        // ensure the session has at least one page recorded.
        return SessionManager.query({ limit: 1, includePages: true }).then(
          sessions => !!sessions.length
        );
    }

    return null;
  }
}
