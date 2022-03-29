/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MailAPIFactory } from "chrome://browser/content/companion/workshop-api-built.js";

const OnlineServicesHelper = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

let workshopAPI = null;
const workshopEnabled = Services.prefs.getBoolPref(
  "browser.pinebuild.workshop.enabled"
);

const isLoggingEnabled = Services.prefs.getBoolPref(
  "browser.pinebuild.workshop-logs.enabled",
  false
);

if (workshopEnabled) {
  const mainThreadServices = OnlineServicesHelper.MainThreadServices(window);
  workshopAPI = window.WORKSHOP_API = MailAPIFactory({
    mainThreadServices,
    isHiddenWindow: false,
    isLoggingEnabled,
  });
  mainThreadServices.registerWorkshopAPI(workshopAPI);
  window.dispatchEvent(new CustomEvent("workshopLoaded"));
}
