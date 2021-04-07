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
import { AwesomeBar } from "./awesomebar.js";
import { MediaList } from "./media.js";
import { WindowList } from "./appbar.js";

const { LightweightThemeConsumer } = ChromeUtils.import(
  "resource://gre/modules/LightweightThemeConsumer.jsm"
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
    prefCheck.checked = Services.prefs.getBoolPref(prefName);
  }

  // on macOS gURLBar is a lazy getter for the real awesomebar from browser.js
  Object.defineProperty(window, "gURLBar", {
    value: new AwesomeBar(),
    configurable: true,
    enumerable: true,
  });

  document.addEventListener("keydown", e => {
    if (e.key == "e" && e.metaKey) {
      let browserWindow = BrowserWindowTracker.getTopWindow();
      browserWindow?.focus();
    }
  });

  document
    .getElementById("settings-button")
    .addEventListener("click", toggleSettings);

  initServices();
  let content = document.getElementById("content");
  content.appendChild(new MediaList("Media"));
  content.appendChild(new WindowList("Apps"));
  content.appendChild(new TopSites());
  content.appendChild(new KeyframeDbList("Today", today));
  content.appendChild(new KeyframeDbList("Earlier", yesterday, today));
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

window.addEventListener(
  "load",
  () => {
    new LightweightThemeConsumer(document);

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
  },
  { once: true }
);

onUnload(() => {
  for (let [prefName, cb] of OBSERVED_PREFS) {
    console.log(`Removing observer for ${prefName}`);
    Services.prefs.removeObserver(prefName, cb);
  }
});
