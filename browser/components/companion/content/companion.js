/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { initServices } from "./calendar.js";
import { TopSites } from "./topsites.js";
import { onLoad, yesterday, today } from "./shared.js";
import { KeyframeDbList } from "./keyframes.js";
import { AwesomeBar } from "./awesomebar.js";

onLoad(() => {
  window.gURLBar = new AwesomeBar();

  document.addEventListener("keydown", e => {
    if (e.key == "e" && e.metaKey) {
      let browserWindow = BrowserWindowTracker.getTopWindow();
      browserWindow?.focus();
    }
  });

  initServices();

  let content = document.getElementById("content");
  content.appendChild(new TopSites());
  content.appendChild(new KeyframeDbList("Today", today));
  content.appendChild(new KeyframeDbList("Yesterday", yesterday, today));
  content.appendChild(
    new KeyframeDbList("What I'm Working On", yesterday, null, "document")
  );
});
