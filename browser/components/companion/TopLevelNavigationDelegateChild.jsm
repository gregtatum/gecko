/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["TopLevelNavigationDelegateChild"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const SHARED_DATA_KEY = "TopLevelNavigationDelegate:IgnoreList";

class TopLevelNavigationDelegateChild extends JSWindowActorChild {
  shouldNavigate(
    docShell,
    uri,
    loadType,
    referrer,
    hasPostData,
    triggeringPrincipal,
    csp
  ) {
    if (uri.scheme != "http" && uri.scheme != "https") {
      return true;
    }

    let isNormalLoad = !!(loadType & Ci.nsIDocShell.LOAD_CMD_NORMAL);

    // For now, for simplicities sake, any POST requests or load types other
    // than "normal" (see nsIDocShell::LoadCommand), we'll let through.
    if (hasPostData || !isNormalLoad) {
      return true;
    }

    let { sharedData } = Services.cpmm;

    let ignoreList = sharedData.get(SHARED_DATA_KEY);
    if (ignoreList && ignoreList.has(this.browsingContext.browserId)) {
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
