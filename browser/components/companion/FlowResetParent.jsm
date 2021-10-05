/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["FlowResetParent"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  CompanionService: "resource:///modules/CompanionService.jsm",
  Services: "resource://gre/modules/Services.jsm",
  SessionManager: "resource:///modules/SessionManager.jsm",
});

class FlowResetParent extends JSWindowActorParent {
  async receiveMessage(message) {
    switch (message.name) {
      case "ViewCompanionBrowseTab":
        let onOpen = () => {
          let browser = this.browsingContext.topChromeWindow.document.getElementById(
            "companion-browser"
          );
          let actor = browser?.browsingContext?.currentWindowGlobal?.getActor(
            "Companion"
          );
          if (actor) {
            actor.viewTab("browse");
          }
        };
        if (!CompanionService.isOpen) {
          let onCompanionOpen = win => {
            if (win !== this.browsingContext.topChromeWindow) {
              return;
            }

            Services.obs.removeObserver(onCompanionOpen, "companion-open");
            onOpen();
          };

          Services.obs.addObserver(onCompanionOpen, "companion-open");
          CompanionService.openCompanion();
        } else {
          onOpen();
        }
        break;
      case "RestoreLastSession":
        SessionManager.restoreLastSession(this.browsingContext.topChromeWindow);
    }
  }
}
