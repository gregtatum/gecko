/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["OnboardingParent"];

const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);
const COMPANION_WIDTH_AFTER_ONBOARDING = "340";
// This const is the index of the onboarding screen which the user should see
// after successfully signing into FxA via web flow.
const ONBOARDING_SCREEN_AFTER_FXA = 2;

class OnboardingParent extends JSWindowActorParent {
  async receiveMessage(message) {
    let browser = this.browsingContext.embedderElement;
    let window = browser.ownerGlobal;
    let doc = window.document;

    switch (message.name) {
      case "OnboardingCompleted":
        Services.prefs.setBoolPref(
          "browser.pinebuild.onboarding.complete",
          true
        );

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
            if (
              aWebProgress.isTopLevel &&
              !ignored.includes(aLocationURI.spec)
            ) {
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
        break;
      case "OpenFxa":
        this._onboardingView = window.gStageManager.currentView;
        doc.body.setAttribute("onboarding", "with-browsing");
        await window.gSync.openFxAEmailFirstPage("pinebuild-onboarding");
        window.gStageManager.setView(this._onboardingView);
        // The promise above is resolved once the user signs into fxa so it's safe to
        // reset the onboarding attribute now.
        doc.body.setAttribute("onboarding", "no-browsing");

        Services.prefs.setIntPref(
          "browser.pinebuild.onboarding.progress",
          ONBOARDING_SCREEN_AFTER_FXA
        );

        // Message child with updated pref value to pass on to component
        this.sendAsyncMessage("OnboardingProgressPrefValueUpdated", {
          prefValue: ONBOARDING_SCREEN_AFTER_FXA,
        });

        break;
      case "GetOnboardingProgressPrefValue":
        return Services.prefs.getIntPref(
          "browser.pinebuild.onboarding.progress",
          0
        );
      case "SetOnboardingProgressPrefValue":
        let newPrefValue = message.data;
        Services.prefs.setIntPref(
          "browser.pinebuild.onboarding.progress",
          newPrefValue
        );
        break;
      case "RecordEvent":
        let { method, object, order, is_last } = message.data;

        // Directly writing out the mapping seems simpler to maintain than
        // cleverly converting arguments into function names.
        const messageToGlean = {
          welcome: {
            shown: Glean.pinebuild.onboardingShownWelcome,
            done: Glean.pinebuild.onboardingDoneWelcome,
          },
          connect_fxa: {
            shown: Glean.pinebuild.onboardingShownConnectFxa,
            done: Glean.pinebuild.onboardingDoneConnectFxa,
          },
          fxa_connected: {
            shown: Glean.pinebuild.onboardingShownFxaConnected,
            done: Glean.pinebuild.onboardingDoneFxaConnected,
          },
          data_prefs: {
            shown: Glean.pinebuild.onboardingShownDataPrefs,
            done: Glean.pinebuild.onboardingDoneDataPrefs,
          },
          congrats: {
            shown: Glean.pinebuild.onboardingShownCongrats,
            done: Glean.pinebuild.onboardingDoneCongrats,
          },
        };

        const gleanEvent = messageToGlean[object][method];
        if (!gleanEvent) {
          console.log(
            `Could not find Glean event for ${object} and ${method}.`
          );
          return null;
        }
        gleanEvent.record({ order, is_last });
    }

    return null;
  }
}
