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
    // This function's job is to find the section-panel back button for the selected
    // named-deck view, and focus it. Since some named-deck views tuck their section-panels
    // within nested browsers that might still be in the midst of loading, we try to detect
    // any <browser> elements within the selected panel and only proceed once that <browser>
    // has finished loading.
    let viewName = companionDeck.selectedViewName;
    let currentView = document.querySelector(
      `[name=${viewName}][slot=selected]`
    );

    let browser = currentView.querySelector("browser");

    // This helper function will do the work of finding the section-panel in the
    // view, waiting for the section-panel to finish any pending LitElement updates,
    // and then focus the back button. This function might be called synchronously
    // if there's no loading <browser> to wait for.
    let focusBackButton = async () => {
      let sectionPanel = null;
      // The view itself might be a section-panel...
      if (currentView.tagName == "section-panel") {
        sectionPanel = currentView;
      } else if (browser) {
        // Or the section-panel might be within a <browser>...
        sectionPanel = browser.contentDocument.querySelector("section-panel");
      } else {
        // Or it might be a child of the current view's shadowRoot, or a direct
        // descendant.
        sectionPanel = currentView.shadowRoot
          ? currentView.shadowRoot.querySelector("section-panel")
          : currentView.querySelector("section-panel");
      }

      if (!sectionPanel) {
        // We tried our best to find a section-panel, and now we're giving up.
        return;
      }

      // We have to wait for Lit to resolve this Promise to ensure that the
      // back button has finished being inserted into the DOM.
      await sectionPanel.updateComplete;
      let backBtn = sectionPanel.shadowRoot.querySelector("button.back-button");
      backBtn?.focus({ focusVisible: e.detail.isKeyboardSource });
    };

    if (!browser || browser.contentDocument.readyState == "complete") {
      // Since there's no <browser>, or the <browser> has finished loading, we can
      // go ahead and search for the back button.
      focusBackButton();
    } else {
      browser.addEventListener("load", focusBackButton, { once: true });
    }
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
