/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

const { UrlbarInput } = ChromeUtils.import(
  "resource:///modules/UrlbarInput.jsm"
);
ChromeUtils.import("resource:///modules/UrlbarPrefs.jsm");
ChromeUtils.import("resource:///modules/UrlbarProviderSearchTips.jsm");
ChromeUtils.import("resource:///modules/UrlbarTokenizer.jsm");
ChromeUtils.import("resource:///modules/UrlbarUtils.jsm");

let gBrowserInit = {
  delayedStartupFinished: true,
};
window.gBrowserInit = gBrowserInit;

function isInitialPage(url) {
  if (!(url instanceof Ci.nsIURI)) {
    try {
      url = Services.io.newURI(url);
    } catch (ex) {
      return false;
    }
  }

  if (url.spec == "about:blank") {
    return true;
  }
  return false;
}

export class AwesomeBar extends UrlbarInput {
  constructor() {
    super({
      textbox: document.getElementById("urlbar"),
      eventTelemetryCategory: "urlbar",
      isInitialPage,
      muxer: "companion",
    });
  }
}
