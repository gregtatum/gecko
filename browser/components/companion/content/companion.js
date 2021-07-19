/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { TopSites } from "./topsites.js";
import { CalendarEventList } from "./calendar.js";
import { MediaList } from "./media.js";
import { PocketList } from "./pocket.js";
import { SnapshotList } from "./snapshots.js";
import { KeyframeDbList, setUpKeyframeRanges } from "./keyframes.js";
import { GlobalHistoryDebugging } from "./globalhistorydebugging.js";
import { RefreshServicesButton } from "./refresh-services-button.js";

function toggleSettings() {
  let settings = document.getElementById("settings");
  if (settings.hasAttribute("hidden")) {
    settings.removeAttribute("hidden");
  } else {
    settings.setAttribute("hidden", "true");
  }
}
window.addEventListener("Companion:ToggleSettings", toggleSettings);

let loadObserved = false;
let companionSetupObserved = false;
function maybeInitializeUI() {
  if (!loadObserved || !companionSetupObserved) {
    return;
  }

  setUpKeyframeRanges();
  document.getElementById("top-sites-placeholder").appendChild(new TopSites());
  document
    .getElementById("events-placeholder")
    .append(new RefreshServicesButton(), new CalendarEventList());
  let content = document.getElementById("content");
  content.appendChild(new MediaList("Media"));
  content.appendChild(new KeyframeDbList("Currently Working On", "workingOn"));
  content.appendChild(new KeyframeDbList("Current Session", "currentSession"));
  content.appendChild(new GlobalHistoryDebugging());
  content.appendChild(new SnapshotList());

  // short-lived placeholder until the suggested snapshots UI is ready
  const suggestedSnapshotsPlaceholder = document.createElement("div");
  const placeholderTitle = document.createElement("h2");
  placeholderTitle.setAttribute("class", "list-title");
  placeholderTitle.textContent = "Suggested Snapshots";
  suggestedSnapshotsPlaceholder.appendChild(placeholderTitle);
  content.appendChild(suggestedSnapshotsPlaceholder);

  let browseContent = document.querySelector("#scroll-browse .content");
  browseContent.appendChild(new PocketList());
}

window.addEventListener(
  "load",
  () => {
    loadObserved = true;
    document.documentElement.setAttribute("docked", "true");
    maybeInitializeUI();
  },
  { once: true }
);

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
    let DEBUG_PREF = "browser.companion.debugUI";
    let toggleDebug = () =>
      document.body.classList.toggle(
        "debugUI",
        window.CompanionUtils.getBoolPref(DEBUG_PREF, false)
      );

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
});

document.dispatchEvent(new CustomEvent("CompanionInit", { bubbles: true }));
