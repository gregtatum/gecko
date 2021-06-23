/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { initCalendarServices, uninitCalendarServices } from "./calendar.js";

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

async function signin(event) {
  await OnlineServices.createService(event.target.id);
  document.getElementById("service-login").className = "connected";
  let services = OnlineServices.getServices();
  initCalendarServices(services);
}

async function signout() {
  let services = OnlineServices.getServices();
  for (let service of services) {
    OnlineServices.deleteService(service);
  }
  uninitCalendarServices();
  document.getElementById("service-login").className = "disconnected";
}

export function initServices() {
  document.getElementById("service-signin").addEventListener("command", signin);
  document.getElementById("service-signout").addEventListener("click", signout);

  let services = OnlineServices.getServices();
  if (services.length) {
    document.getElementById("service-login").className = "connected";
    initCalendarServices(services);
    //initEmailServices(services);
  } else {
    document.getElementById("service-login").className = "disconnected";
  }
}
