/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["WorkshopBootstrap"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  HiddenFrame: "resource://gre/modules/HiddenFrame.jsm",
});

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const workshopEnabled = Services.prefs.getBoolPref(
  "browser.pinebuild.workshop.enabled",
  false
);

class WorkshopBootstrap {
  static #hiddenFrame = null;

  static async createHiddenWindow() {
    if (!this.#hiddenFrame && workshopEnabled) {
      this.#hiddenFrame = new HiddenFrame();
      const frame = await this.#hiddenFrame.get();
      const doc = frame.document;
      const browser = doc.createXULElement("browser");
      browser.setAttribute("remote", "true");
      browser.setAttribute("remoteType", "privilegedabout");
      browser.setAttribute("type", "content");
      browser.setAttribute(
        "src",
        "chrome://browser/content/companion/workshop.xhtml"
      );
      doc.documentElement.appendChild(browser);
    }
  }
}
