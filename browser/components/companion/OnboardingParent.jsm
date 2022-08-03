/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["OnboardingParent"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const lazy = {};
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "ROOT_URL",
  "identity.fxaccounts.remote.root"
);

const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);

const COMPANION_WIDTH_AFTER_ONBOARDING = "340";
// This const is the index of the onboarding screen which the user should see
// after successfully signing into FxA via web flow.
const ONBOARDING_SCREEN_AFTER_FXA = 2;
const RESET_PASSWORD_VERIFIED_PATH = "reset_password_verified";
const CONNECT_ANOTHER_DEVICE_PATH = "connect_another_device";
const ONBOARDING_URL = "about:onboarding";

class OnboardingParent extends JSWindowActorParent {
  async receiveMessage(message) {
    let browser = this.browsingContext.embedderElement;
    if (!browser) {
      return null;
    }
    let window = browser.ownerGlobal;
    let doc = window.document;
    let fxaListener;

    switch (message.name) {
      case "OnboardingCompleted":
        Services.prefs.setBoolPref(
          "browser.pinebuild.onboarding.complete",
          true
        );

        doc.body.removeAttribute("onboarding");
        window.gBrowser.removeProgressListener(fxaListener);

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
        let email = message.data;
        doc.body.setAttribute("onboarding", "with-browsing");

        function concludeFxaFlow(obj) {
          doc.body.setAttribute("onboarding", "no-browsing");
          window.gStageManager.reset({ url: ONBOARDING_URL });
          Services.prefs.setIntPref(
            "browser.pinebuild.onboarding.progress",
            ONBOARDING_SCREEN_AFTER_FXA
          );

          // Message child with updated pref value to pass on to component
          obj.sendAsyncMessage("OnboardingProgressPrefValueUpdated", {
            prefValue: ONBOARDING_SCREEN_AFTER_FXA,
          });
        }

        // This progress listener listens to location changes to help get users who are deviating
        // from the original onboarding fxa flow, for e.g. when a user resets password instead of
        // signing in directly, back onto the fxa sign in page and subsequently back to about:onboarding.
        fxaListener = {
          QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener"]),

          onLocationChange(aWebProgress, aRequest, aLocationURI, aFlags) {
            if (aWebProgress.isTopLevel) {
              if (
                aLocationURI.spec.startsWith(
                  lazy.ROOT_URL + RESET_PASSWORD_VERIFIED_PATH
                )
              ) {
                window.gSync.openFxAEmailFirstPage(
                  "pinebuild-onboarding",
                  email
                );
              } else if (
                aLocationURI.spec.startsWith(
                  lazy.ROOT_URL + CONNECT_ANOTHER_DEVICE_PATH
                )
              ) {
                concludeFxaFlow(this);
              }
            }
          },
        };

        fxaListener.onLocationChange = fxaListener.onLocationChange.bind(this);
        window.gBrowser.addProgressListener(fxaListener);

        await window.gSync.openFxAEmailFirstPage("pinebuild-onboarding", email);
        concludeFxaFlow(this);
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
