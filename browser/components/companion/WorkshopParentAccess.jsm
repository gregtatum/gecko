/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["WorkshopParentAccess"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const workshopEnabled = Services.prefs.getBoolPref(
  "browser.pinebuild.workshop.enabled",
  false
);

const WorkshopParentAccess = {
  workshopAPI: null,
  async getWorkshopAPI() {
    if (!this.workshopAPI) {
      await this.init();
      return this.workshopAPI;
    }

    return this.workshopAPI;
  },
  async init() {
    if (workshopEnabled) {
      const windowlessBrowser = Services.appShell.createWindowlessBrowser(
        true,
        0
      );

      const system = Services.scriptSecurityManager.getSystemPrincipal();
      const chromeShell = windowlessBrowser.docShell.QueryInterface(
        Ci.nsIWebNavigation
      );
      chromeShell.createAboutBlankContentViewer(system, system);

      const doc = chromeShell.document;
      const scriptElem = doc.createElement("script");
      scriptElem.setAttribute("type", "module");
      scriptElem.setAttribute(
        "src",
        "chrome://browser/content/companion/workshopAPIParentAccess.js"
      );
      doc.body.appendChild(scriptElem);
      const win = doc.defaultView;

      await new Promise(resolve => {
        win.addEventListener("workshopLoaded", resolve, { once: true });
      });

      this.workshopAPI = Cu.waiveXrays(win.WORKSHOP_API);
    }
  },
};
