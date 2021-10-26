/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MailAPIFactory } from "chrome://browser/content/companion/workshop-api-built.js";

const OnlineServicesHelper = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);

const mainThreadServices = OnlineServicesHelper.MainThreadServices(window);
const workshopAPI = MailAPIFactory(mainThreadServices);

// Let mainThreadServices know about the workshopAPI obj
// so that we can properly handle "beforeunload" events.
mainThreadServices.registerWorkshopAPI(workshopAPI);

export { workshopAPI };
