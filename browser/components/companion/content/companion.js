/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { initServices } from "./services.js";
import { TopSites } from "./topsites.js";
import { PocketList } from "./pocket.js";
import { onLoad, onUnload, yesterday, today } from "./shared.js";
import { KeyframeDbList } from "./keyframes.js";
import { MediaList } from "./media.js";
import { WindowList } from "./appbar.js";
import { GlobalHistoryDebugging } from "./globalhistorydebugging.js";

const { LightweightThemeConsumer } = ChromeUtils.import(
  "resource://gre/modules/LightweightThemeConsumer.jsm"
);

const { CompanionService } = ChromeUtils.import(
  "resource:///modules/CompanionService.jsm"
);

let OBSERVED_PREFS = new Map();
onLoad(() => {
  // Cheesy approximation of preferences for the demo settings. Add a checkbox with
  // data-pref attribute and the state will get synced & toggled automatically.
  // Components that care about it can listen to CompanionObservedPrefChanged to rerender.
  let settings = document.getElementById("settings");
  for (let prefCheck of settings.querySelectorAll("[data-pref]")) {
    let prefName = prefCheck.getAttribute("data-pref");
    OBSERVED_PREFS.set(prefName, (subject, topic, data) => {
      prefCheck.checked = Services.prefs.getBoolPref(prefName);
      document.dispatchEvent(
        new CustomEvent("CompanionObservedPrefChanged", { bubbles: true })
      );
    });
    Services.prefs.addObserver(prefName, OBSERVED_PREFS.get(prefName));
    prefCheck.addEventListener("click", () => {
      Services.prefs.setBoolPref(prefName, prefCheck.checked);
    });
    prefCheck.checked = Services.prefs.getBoolPref(prefName, false);
  }

  document.addEventListener("keydown", e => {
    if (e.key == "e" && e.metaKey) {
      let browserWindow = BrowserWindowTracker.getTopWindow();
      browserWindow?.focus();
    }
  });

  document
    .getElementById("settings-button")
    .addEventListener("click", toggleSettings);
  document
    .getElementById("dock-button")
    .addEventListener("click", () => CompanionService.dockCompanion());

  document.getElementById("top-sites-placeholder").appendChild(new TopSites());
  initServices();
  let content = document.getElementById("content");
  content.appendChild(new MediaList("Media"));
  content.appendChild(new WindowList("Apps"));
  content.appendChild(
    new KeyframeDbList(
      "Currently Working On",
      yesterday,
      null,
      null,
      "getTopKeypresses"
    )
  );
  content.appendChild(new KeyframeDbList("Current Session", today));
  content.appendChild(new GlobalHistoryDebugging());
  content.appendChild(new PocketList());
});

function toggleSettings() {
  let settings = document.getElementById("settings");
  if (settings.hasAttribute("hidden")) {
    settings.removeAttribute("hidden");
  } else {
    settings.setAttribute("hidden", "true");
  }
}
window.toggleSettings = toggleSettings;

window.addEventListener(
  "load",
  () => {
    new LightweightThemeConsumer(document);

    if (window.top === window) {
      if (!document.documentElement.hasAttribute("width")) {
        const TARGET_WIDTH = 1280;
        const TARGET_HEIGHT = 1040;
        let width = Math.min(screen.availWidth * 0.9, TARGET_WIDTH);
        let height = Math.min(screen.availHeight * 0.9, TARGET_HEIGHT);

        document.documentElement.setAttribute("width", width);
        document.documentElement.setAttribute("height", height);

        if (width < TARGET_WIDTH && height < TARGET_HEIGHT) {
          document.documentElement.setAttribute("sizemode", "maximized");
        }
      }
    } else {
      document.documentElement.setAttribute("docked", "true");
    }
  },
  { once: true }
);

// Add the ability to show elements with class="debug" that help development
// behind the "companion.debugUI" pref.
let DEBUG_PREF = "browser.companion.debugUI";
let toggleDebug = () =>
  document.body.classList.toggle(
    "debugUI",
    Services.prefs.getBoolPref(DEBUG_PREF, false)
  );

Services.prefs.addObserver(DEBUG_PREF, toggleDebug);
toggleDebug();

onUnload(() => {
  for (let [prefName, cb] of OBSERVED_PREFS) {
    console.log(`Removing observer for ${prefName}`);
    Services.prefs.removeObserver(prefName, cb);
  }
});
