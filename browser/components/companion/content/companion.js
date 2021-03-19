/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { initServices } from "./services.js";
import { TopSites } from "./topsites.js";
import { onLoad, yesterday, today } from "./shared.js";
import { KeyframeDbList } from "./keyframes.js";
import { AwesomeBar } from "./awesomebar.js";
import { MediaList } from "./media.js";

onLoad(() => {
  window.docShell.browsingContext.prefersColorSchemeOverride = "dark";

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

  initServices();

  let content = document.getElementById("content");
  content.appendChild(new TopSites());
  content.appendChild(
    new KeyframeDbList("What I'm Working On", yesterday, null, "document")
  );
  content.appendChild(new KeyframeDbList("Today", today));
  content.appendChild(new KeyframeDbList("Earlier", yesterday, today));
  content.appendChild(new MediaList("Media"));
});
