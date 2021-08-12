/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["TopLevelNavigationDelegateParent"];

class TopLevelNavigationDelegateParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name == "LoadURI") {
      let { uriString, triggeringPrincipal } = message.data;

      let gBrowser = this.browsingContext.topChromeWindow.gBrowser;
      let newTab = gBrowser.addWebTab(uriString, {
        triggeringPrincipal,
        skipAnimation: true,
      });
      gBrowser.selectedTab = newTab;
    }
  }
}
