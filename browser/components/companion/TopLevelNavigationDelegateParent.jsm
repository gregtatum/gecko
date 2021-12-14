/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["TopLevelNavigationDelegateParent"];

ChromeUtils.defineModuleGetter(
  this,
  "E10SUtils",
  "resource://gre/modules/E10SUtils.jsm"
);

class TopLevelNavigationDelegateParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name == "LoadURI") {
      let { uriString, triggeringPrincipal, referrerInfo } = message.data;

      let gBrowser = this.browsingContext.topChromeWindow.gBrowser;
      referrerInfo = E10SUtils.deserializeReferrerInfo(referrerInfo);

      let tabOptions = {
        skipAnimation: true,
        skipLoad: true,
        referrerInfo,
      };

      let newTab = gBrowser.addTrustedTab(null, tabOptions);

      let options = {
        triggeringPrincipal,
        referrerInfo,
      };
      newTab.linkedBrowser.loadURI(uriString, options);
      gBrowser.selectedTab = newTab;
    }
  }
}
