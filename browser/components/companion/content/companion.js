/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import "./section-panel.js";
import { CalendarEventList } from "./calendar.js";
import { BrowseList } from "./browse.js";
import { MediaList } from "./media.js";
import { FullSessionList, LastSessionList, initSessionUI } from "./sessions.js";
import { ServicesOnboarding } from "./onboarding-services.js";
import {
  SuggestedSnapshotList,
  RecentlyClosedSnapshotList,
} from "./snapshots.js";
import { GlobalHistoryDebugging } from "./globalhistorydebugging.js";
import { initNotifications, uninitNotifications } from "./notifications.js";
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

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
  let initPromises = [window.gCalendarEventListener.initialized];

  let eventsPlaceholder = document.getElementById("events-placeholder");
  if (
    Services.prefs.getBoolPref(
      "browser.pinebuild.companion-service-onboarding.enabled",
      false
    )
  ) {
    let servicesOnboarding = new ServicesOnboarding();
    initPromises.push(servicesOnboarding.updateComplete);
    eventsPlaceholder.parentElement.insertBefore(
      servicesOnboarding,
      eventsPlaceholder
    );
  }
  eventsPlaceholder.appendChild(new CalendarEventList());

  let content = document.getElementById("content");
  content.appendChild(new MediaList("Media"));
  content.appendChild(new GlobalHistoryDebugging());
  content.appendChild(new SuggestedSnapshotList("Suggested"));

  let browseContent = document.querySelector("#scroll-browse .content");
  let browseList = new BrowseList();
  browseContent.appendChild(browseList);
  browseContent.appendChild(new LastSessionList({ showTitle: true }));
  browseContent.appendChild(new RecentlyClosedSnapshotList("Recently Closed"));

  let sessionContent = document.querySelector("#sessions .content");
  sessionContent.appendChild(new FullSessionList());

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
      showPanel("passwords");
    });

    window.addEventListener("Companion:BrowsePanel", () => {
      hidePanel();
    });
  }

  if (
    Services.prefs.getBoolPref(
      "browser.pinebuild.calendar.browseEnabled",
      false
    )
  ) {
    if (!document.querySelector(".calendar-panel")) {
      let template = document.getElementById("template-calendar-panel");
      let fragment = template.content.cloneNode(true);
      browseContent.appendChild(fragment);
    }

    document.querySelector(".calendar").hidden = false;

    browseList.querySelector(".calendar").addEventListener("click", () => {
      showPanel("calendar");
    });

    document.addEventListener("section-panel-back", () => {
      hidePanel();
    });
  }

  if (
    Services.prefs.getBoolPref("browser.pinebuild.downloads.enabled", false)
  ) {
    document.querySelector(".downloads").hidden = false;
  }

  initSessionUI();

  initNotifications();

  // This is used for tests to ensure that the various components have initialized.
  // If your component has delayed initialization, then you will want to add something
  // to wait for it here.
  Promise.all(initPromises).then(() => {
    resolveInitialized();
    window.dispatchEvent(new Event("CompanionInitialized", { bubbles: true }));
  });
}

function showPanel(name) {
  for (let child of document.querySelectorAll("#scroll-browse .content > *")) {
    child.hidden = !child.classList.contains(`${name}-panel`);
  }
  document.dispatchEvent(new Event("browse-panel-shown"));
}
function hidePanel() {
  for (let child of document.querySelectorAll("#scroll-browse .content > *")) {
    child.hidden = child.classList.contains("browse-section-panel");
  }
  document.dispatchEvent(new Event("browse-panel-hidden"));
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
  uninitNotifications();
});

document.dispatchEvent(new CustomEvent("CompanionInit", { bubbles: true }));
