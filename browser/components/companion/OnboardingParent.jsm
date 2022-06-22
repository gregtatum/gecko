/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["OnboardingParent"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);
const COMPANION_WIDTH_AFTER_ONBOARDING = "340";

class OnboardingParent extends JSWindowActorParent {
  async receiveMessage(message) {
    if (message.name == "OnboardingCompleted") {
      Services.prefs.setBoolPref("browser.pinebuild.onboarding.complete", true);

      let browser = this.browsingContext.embedderElement;
      let window = browser.ownerGlobal;

      let doc = window.document;
      doc.body.removeAttribute("onboarding");

      doc.body.setAttribute("flow-reset", true);
      window.gStageManager.reset({
        url: "about:flow-reset",
      });
      let companion = doc.getElementById("companion-box");
      companion.setAttribute("width", COMPANION_WIDTH_AFTER_ONBOARDING);

      const listener = {
        QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener"]),

        onLocationChange(aWebProgress, aRequest, aLocationURI, aFlags) {
          // Wait for the first location change away from the about:flow-reset page,
          // loading about:flow-reset includes load events for about:blank and there
          // is no problem with being in flow reset state over about:blank.
          let ignored = ["about:flow-reset", "about:blank"];
          if (aWebProgress.isTopLevel && !ignored.includes(aLocationURI.spec)) {
            window.document.body.removeAttribute("flow-reset");
            window.gBrowser.removeProgressListener(listener);
          }
        },
      };

      listener.onLocationChange = listener.onLocationChange.bind(this);
      window.gBrowser.addProgressListener(listener);

      // Enable commands that were disabled during onboarding.
      let cmd = doc.getElementById("cmd_newNavigator");
      cmd.removeAttribute("disabled");

      cmd = doc.getElementById("Browser:OpenFile");
      cmd.setAttribute("disabled", false);

      cmd = doc.getElementById("Browser:ShowAllHistory");
      cmd.removeAttribute("disabled");

      let menu = doc.getElementById("history-menu");
      menu.hidden = false;

      let item = doc.getElementById("sync-setup");
      item.removeAttribute("disabled");

      if (AppConstants.platform == "macosx") {
        let hiddenWindow = Services.appShell.hiddenDOMWindow;
        item = hiddenWindow.document.getElementById("macDockMenuNewWindow");
        item.disabled = false;
      }
    }
  }
}
