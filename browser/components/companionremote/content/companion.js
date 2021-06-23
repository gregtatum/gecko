/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Services } from "./services.js";
import { TopSites } from "./topsites.js";
import { MediaList } from "./media.js";
import { PocketList } from "./pocket.js";
import { KeyframeDbList } from "./keyframes.js";

function toggleSettings() {
  let settings = document.getElementById("settings");
  if (settings.hasAttribute("hidden")) {
    settings.removeAttribute("hidden");
  } else {
    settings.setAttribute("hidden", "true");
  }
}
window.addEventListener("Companion:ToggleSettings", toggleSettings);

window.addEventListener(
  "load",
  () => {
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

    document
      .getElementById("top-sites-placeholder")
      .appendChild(new TopSites());
    let content = document.getElementById("content");
    content.appendChild(new MediaList("Media"));
    content.appendChild(
      new KeyframeDbList("Currently Working On", "workingOn")
    );
    content.appendChild(
      new KeyframeDbList("Current Session", "currentSession")
    );
    content.appendChild(new PocketList());
    document.getElementById("service-login").appendChild(new Services());
  },
  { once: true }
);

document.dispatchEvent(new CustomEvent("CompanionInit", { bubbles: true }));
