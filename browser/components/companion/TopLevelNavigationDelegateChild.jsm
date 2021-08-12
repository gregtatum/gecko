/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["TopLevelNavigationDelegateChild"];

class TopLevelNavigationDelegateChild extends JSWindowActorChild {
  shouldNavigate(
    docShell,
    uri,
    referrer,
    hasPostData,
    triggeringPrincipal,
    csp
  ) {
    if (uri.scheme != "http" && uri.scheme != "https") {
      return true;
    }

    if (hasPostData) {
      return true;
    }

    if (docShell.hasLoadedNonBlankURI) {
      this.sendAsyncMessage("LoadURI", {
        uriString: uri.spec,
        triggeringPrincipal,
      });
      return false;
    }

    return true;
  }
}

TopLevelNavigationDelegateChild.prototype.QueryInterface = ChromeUtils.generateQI(
  ["nsITopLevelNavigationDelegate"]
);
