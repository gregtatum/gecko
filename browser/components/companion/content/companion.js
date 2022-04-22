/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import "./section-panel.js";
import { CalendarEventList } from "./calendar.js";
import { BrowseList } from "./browse.js";
import { MediaList } from "./media.js";
import { FullSessionList, LastSessionList, initSessionUI } from "./sessions.js";
import {
  SnapshotGroupList,
  SnapshotGroupListDetail,
} from "./snapshot-groups.js";
import { ServicesOnboarding } from "./onboarding-services.js";
import {
  SuggestedSnapshotList,
  RecentlyClosedSnapshotList,
} from "./snapshots.js";
import { StageManagerDebugging } from "./stagemanagerdebugging.js";
import { initNotifications } from "./notifications.js";
import { Workshop, workshopEnabled } from "./workshopAPI.js";
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

// Helper to open a URL in the main browser pane.
window.openUrl = url => {
  window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", { url });
};

window.gInitialized = false;

let loadObserved = false;
let companionSetupObserved = false;

/**
 * Initialize the UI once the load event and the Companion:Setup message have been observed
 *
 */
function maybeInitializeUI() {
  if (!loadObserved || !companionSetupObserved) {
    return;
  }

  let eventsPlaceholder = document.getElementById("events-placeholder");
  if (
    Services.prefs.getBoolPref(
      "browser.pinebuild.companion-service-onboarding.enabled",
      false
    )
  ) {
    let servicesOnboarding = new ServicesOnboarding();
    eventsPlaceholder.parentElement.insertBefore(
      servicesOnboarding,
      eventsPlaceholder
    );
  }
  eventsPlaceholder.appendChild(new CalendarEventList());

  let content = document.getElementById("content");
  content.appendChild(new MediaList("Media"));
  content.appendChild(new StageManagerDebugging());
  content.appendChild(new SuggestedSnapshotList("Suggested"));

  let browseContent = document.querySelector("#scroll-browse .content");
  let browseList = new BrowseList();
  browseContent.appendChild(browseList);

  let initialSessionData = window.CompanionUtils.initialSessionData();
  browseContent.appendChild(
    new LastSessionList({ showTitle: true, initialSessionData })
  );
  browseContent.appendChild(new RecentlyClosedSnapshotList("Recently Closed"));

  let sessionContent = document.querySelector("#sessions .content");
  sessionContent.appendChild(new FullSessionList({ initialSessionData }));

  let snapshotGroupsContent = document.querySelector(
    "#snapshot-groups .content"
  );
  snapshotGroupsContent.appendChild(new SnapshotGroupList());

  let snapshotGroupsDetailContent = document.querySelector(
    "#snapshot-groups-detail .content"
  );
  snapshotGroupsDetailContent.appendChild(new SnapshotGroupListDetail());

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

  if (workshopEnabled && Cu.isInAutomation) {
    window.addEventListener("Companion:TestCreateAccount", e => {
      Workshop.connectAccount(e.detail.type);
    });
    window.addEventListener("Companion:TestDeleteAccount", e => {
      let account = Workshop.getAccountByType(e.detail.type);
      Workshop.deleteAccount(account);
    });
  }

  if (
    Services.prefs.getBoolPref("browser.pinebuild.downloads.enabled", false)
  ) {
    document.querySelector(".downloads").hidden = false;
  }

  initSessionUI();

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
});

window.addEventListener(
  "Companion:ResetFlowExited",
  () => {
    document.body.removeAttribute("flow-reset-startup");
  },
  { once: true }
);

document.dispatchEvent(new CustomEvent("CompanionInit", { bubbles: true }));
