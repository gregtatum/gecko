/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["CompanionService"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  Services: "resource://gre/modules/Services.jsm",
});

const CompanionService = {
  openCompanion() {
    let container = Services.wm.getMostRecentWindow("Firefox:Container");

    if (container && !container.closed) {
      container.focus();
      return;
    }

    Services.ww.openWindow(
      null,
      "chrome://browser/content/companion/companion.xhtml",
      "_blank",
      "chrome,all,dialog=no,resizable=yes",
      null
    );
  },
};
