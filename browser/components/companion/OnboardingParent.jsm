/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["OnboardingParent"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);

class OnboardingParent extends JSWindowActorParent {
  async receiveMessage(message) {
    if (message.name == "OnboardingCompleted") {
      Services.prefs.setBoolPref("browser.pinebuild.onboarding.complete", true);

      let browser = this.browsingContext.embedderElement;
      let window = browser.ownerGlobal;
      window.gStageManager.reset({
        url: "about:flow-reset",
      });

      // Enable commands that were disabled during onboarding.
      let doc = window.document;
      let cmd = doc.getElementById("cmd_newNavigator");
      cmd.removeAttribute("disabled");

      cmd = doc.getElementById("Browser:OpenFile");
      cmd.setAttribute("disabled", false);

      cmd = doc.getElementById("Browser:ShowAllHistory");
      cmd.removeAttribute("disabled");

      let menu = doc.getElementById("history-menu");
      menu.hidden = false;

      if (AppConstants.platform == "macosx") {
        let hiddenWindow = Services.appShell.hiddenDOMWindow;
        let item = hiddenWindow.document.getElementById("macDockMenuNewWindow");
        item.disabled = false;
      }
    }
  }
}
