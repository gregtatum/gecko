/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { initCalendarServices } from "./calendar.js";
//import { initEmailServices } from "./email.js";

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

async function signin() {
  await OnlineServices.createService(
    Services.prefs.getCharPref("onlineservices.defaultType", "google")
  );
  document.getElementById("scroll").className = "connected";
  let services = OnlineServices.getServices();
  initCalendarServices(services);
  //initEmailServices(services);
  window.focus();
}

export function initServices() {
  document.getElementById("service-signin").addEventListener("click", signin);

  let services = OnlineServices.getServices();
  if (services.length) {
    document.getElementById("scroll").className = "connected";
    initCalendarServices(services);
    //initEmailServices(services);
  } else {
    document.getElementById("scroll").className = "disconnected";
  }
}
