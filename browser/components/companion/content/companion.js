/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import "./section-panel.js";

import { initNotifications } from "./notifications.js";
import { Workshop, workshopEnabled } from "./workshopAPI.js";

// Helper to open a URL in the main browser pane.
window.openUrl = url => {
  window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", { url });
};

window.gInitialized = false;

let loadObserved = false;
let companionSetupObserved = false;

window.exitFlowReset = viewBrowse => {
  if (viewBrowse) {
    document.getElementById("companion-deck").selectedViewName = "browse";
  }
  document.body.setAttribute("flow-reset-startup", true);
  document.body.removeAttribute("flow-reset");
};

/**
 * Initialize the UI once the load event and the Companion:Setup message have been observed
 *
 */
function maybeInitializeUI() {
  if (!loadObserved || !companionSetupObserved) {
    return;
  }

  if (workshopEnabled && Cu.isInAutomation) {
    window.addEventListener("Companion:TestCreateAccount", e => {
      Workshop.connectAccount(e.detail.type);
    });
    window.addEventListener("Companion:TestDeleteAccount", e => {
      let account = Workshop.getAccountByType(e.detail.type);
      Workshop.deleteAccount(account);
    });
  }

  window.addEventListener("Companion:ResetFlowEntered", () => {
    document.body.setAttribute("flow-reset", true);
  });
  window.addEventListener("Companion:ResetFlowExited", () => {
    document.body.removeAttribute("flow-reset");
    let randomImageNumber = Math.ceil(Math.random() * 4);
    let flowResetImageElement = document.getElementById("flow-reset-image");
    flowResetImageElement.src = `chrome://browser/content/companion/flow-reset-bg${randomImageNumber}.png`;
  });
  window.addEventListener("Companion:ShowPasswordsPanel", () => {
    document.getElementById("companion-deck").selectedViewName = "passwords";
  });

  const companionDeck = document.getElementById("companion-deck");

  let goBack = e => {
    const previousViewName = companionDeck.selectedViewName;
    document.dispatchEvent(new Event("browse-panel-hidden"));
    companionDeck.selectedViewName = "browse";
    const focusEl = document.querySelector(`button.${previousViewName}`);
    let focusVisible = e?.detail?.isKeyboardSource;
    focusEl?.focus({
      focusVisible,
    });
  };

  window.addEventListener("section-panel-back", goBack);
  window.addEventListener("Companion:BrowsePanel", goBack);

  companionDeck.addEventListener("view-changed", e => {
    // Clumsily wait for the iframes in the passwords and downloads
    // browse submenu items to load, before focusing their back
    // buttons. We would eventually like to do this in a cleaner, more
    // reliable way (MR2-2770).
    setTimeout(() => {
      let currentView = document.querySelector(
        `[name=${companionDeck.selectedViewName}][slot=selected]`
      );
      if (!currentView) {
        return;
      }
      let backBtn;
      if (currentView.attributes.name.value == "passwords") {
        const passwordsFrame = document.getElementById(
          "companion-login-browser"
        );
        const sectionPanel = passwordsFrame.contentDocument.querySelector(
          "section-panel"
        );
        backBtn = sectionPanel.shadowRoot.querySelector("button.back-button");
      } else {
        backBtn = currentView.shadowRoot
          ? currentView.shadowRoot.querySelector("button.back-button")
          : currentView.querySelector("button.back-button");
      }
      backBtn?.focus({ focusVisible: e.detail.isKeyboardSource });
    }, 100);
  });

  // When "browser.startup.launchOnOSLogin" is true, pinebuildBackground() will
  // initialize itself and our notification implementation, so we can rely on
  // that. However, if it's not enabled, we need to initialize notifications here.
  if (
    !window.CompanionUtils.getBoolPref("browser.startup.launchOnOSLogin", false)
  ) {
    initNotifications();
  }

  window.gInitialized = true;
  // This is used for tests to ensure that the various components have initialized.
  // If your component has delayed initialization, then you will want to add something
  // to wait for it here.
  window.dispatchEvent(new Event("CompanionInitialized", { bubbles: true }));
}

window.addEventListener(
  "load",
  () => {
    loadObserved = true;
    maybeInitializeUI();
  },
  { once: true }
);

const DEBUG_PREF = "browser.companion.debugUI";
function toggleDebug() {
  document.body.classList.toggle(
    "debugUI",
    window.CompanionUtils.getBoolPref(DEBUG_PREF, false)
  );
}

window.addEventListener(
  "Companion:Setup",
  () => {
    companionSetupObserved = true;
    // Add the ability to show elements with class="debug" that help development
    // behind the "companion.debugUI" pref.
    window.CompanionUtils.addPrefObserver(DEBUG_PREF, toggleDebug);
    toggleDebug();
    maybeInitializeUI();
  },
  { once: true }
);

window.addEventListener("unload", () => {
  window.CompanionUtils.removePrefObserver(DEBUG_PREF, toggleDebug);
});

window.addEventListener(
  "Companion:ResetFlowExited",
  () => {
    document.body.removeAttribute("flow-reset-startup");
  },
  { once: true }
);

document.dispatchEvent(new CustomEvent("CompanionInit", { bubbles: true }));
