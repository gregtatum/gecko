/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { CalendarEventList } from "./calendar.js";
import { BrowseList } from "./browse.js";
import { MediaList } from "./media.js";
import { PocketList } from "./pocket.js";
import {
  SuggestedSnapshotList,
  RecentlyClosedSnapshotList,
} from "./snapshots.js";
import { GlobalHistoryDebugging } from "./globalhistorydebugging.js";
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function toggleSettings() {
  let settings = document.getElementById("settings");
  if (settings.hasAttribute("hidden")) {
    settings.removeAttribute("hidden");
  } else {
    settings.setAttribute("hidden", "true");
  }
}
window.addEventListener("Companion:ToggleSettings", toggleSettings);

// Helper to open a URL in the main browser pane.
window.openUrl = url => {
  window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", { url });
};

let resolveInitialized;

window.gInitialized = new Promise(resolve => {
  resolveInitialized = resolve;
});

let loadObserved = false;
let companionSetupObserved = false;
function maybeInitializeUI() {
  if (!loadObserved || !companionSetupObserved) {
    return;
  }

  if (Services.prefs.getBoolPref("browser.pinebuild.sessionSetAside")) {
    let setAsideButton = document.getElementById("debug-session-change-button");
    setAsideButton.removeAttribute("hidden");
    setAsideButton.addEventListener("click", () => {
      window.CompanionUtils.sendAsyncMessage("Companion:ChangeSession", {
        newSessionId: null, // TODO
      });
    });
  }
  document
    .getElementById("events-placeholder")
    .appendChild(new CalendarEventList());
  let content = document.getElementById("content");
  content.appendChild(new MediaList("Media"));
  content.appendChild(new GlobalHistoryDebugging());
  content.appendChild(new SuggestedSnapshotList("Suggested Snapshots"));

  let browseContent = document.querySelector("#scroll-browse .content");
  let browseList = new BrowseList();
  browseContent.appendChild(browseList);
  browseContent.appendChild(new RecentlyClosedSnapshotList("Recently Closed"));
  browseContent.appendChild(new PocketList());

  if (
    Services.prefs.getBoolPref("browser.companion.passwords.enabled", false)
  ) {
    if (!document.querySelector(".passwords-panel")) {
      let template = document.getElementById("template-passwords-panel");
      let fragment = template.content.cloneNode(true);
      browseContent.appendChild(fragment);
    }

    document.querySelector(".passwords").hidden = false;

    browseList.querySelector(".passwords").addEventListener("click", () => {
      togglePasswordPanel(false);
    });

    window.addEventListener("Companion:BrowsePanel", () => {
      togglePasswordPanel(true);
    });
  }

  // This is used for tests to ensure that the various components have initialized.
  // If your component has delayed initialization, then you will want to add something
  // to wait for it here.
  Promise.all([window.gCalendarEventListener.initialized]).then(
    resolveInitialized
  );
}

function togglePasswordPanel(hidePasswordPanel) {
  for (let child of document.querySelector("#scroll-browse .content")
    .children) {
    child.hidden = child.classList.contains("passwords-panel")
      ? hidePasswordPanel
      : !hidePasswordPanel;
  }
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

let OBSERVED_PREFS = new Map();
window.addEventListener(
  "Companion:Setup",
  () => {
    companionSetupObserved = true;
    // Cheesy approximation of preferences for the demo settings. Add a checkbox with
    // data-pref attribute and the state will get synced & toggled automatically.
    // Components that care about it can listen to CompanionObservedPrefChanged to rerender.
    let settings = document.getElementById("settings");
    for (let prefCheck of settings.querySelectorAll("[data-pref]")) {
      let prefName = prefCheck.getAttribute("data-pref");
      let handler = (subject, topic, data) => {
        prefCheck.checked = window.CompanionUtils.getBoolPref(prefName);
        document.dispatchEvent(
          new CustomEvent("CompanionObservedPrefChanged", { bubbles: true })
        );
      };
      window.CompanionUtils.addPrefObserver(prefName, handler);
      OBSERVED_PREFS.set(prefName, handler);
      prefCheck.addEventListener("click", () => {
        window.CompanionUtils.setBoolPref(prefName, prefCheck.checked);
      });
      prefCheck.checked = window.CompanionUtils.getBoolPref(prefName, false);
    }

    // Add the ability to show elements with class="debug" that help development
    // behind the "companion.debugUI" pref.
    window.CompanionUtils.addPrefObserver(DEBUG_PREF, toggleDebug);
    toggleDebug();
    maybeInitializeUI();
  },
  { once: true }
);

window.addEventListener("unload", () => {
  for (let [prefName, cb] of OBSERVED_PREFS) {
    window.CompanionUtils.removePrefObserver(prefName, cb);
  }
  window.CompanionUtils.removePrefObserver(DEBUG_PREF, toggleDebug);
});

document.dispatchEvent(new CustomEvent("CompanionInit", { bubbles: true }));
