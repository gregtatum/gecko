/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["OnboardingParent"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

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
      let cmd = window.document.getElementById("Browser:OpenFile");
      cmd.setAttribute("disabled", false);
    }
  }
}
