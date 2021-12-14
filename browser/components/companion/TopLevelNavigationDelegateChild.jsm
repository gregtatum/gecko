/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["TopLevelNavigationDelegateChild"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

ChromeUtils.defineModuleGetter(
  this,
  "E10SUtils",
  "resource://gre/modules/E10SUtils.jsm"
);

const SHARED_DATA_KEY = "TopLevelNavigationDelegate:IgnoreList";

class TopLevelNavigationDelegateChild extends JSWindowActorChild {
  shouldNavigate(
    docShell,
    uri,
    loadType,
    referrerInfo,
    hasPostData,
    triggeringPrincipal,
    csp
  ) {
    if (uri.scheme != "http" && uri.scheme != "https") {
      return true;
    }

    let isNormalLoad = !!(loadType & Ci.nsIDocShell.LOAD_CMD_NORMAL);

    // Note that loadType is a combination of both nsIDocShell load commands
    // and nsIWebNavigation load flags. The load flags are shifted 16 bits
    // to the left.
    let isHistoryReplace = !!(
      loadType &
      (Ci.nsIWebNavigation.LOAD_FLAGS_REPLACE_HISTORY << 16)
    );

    // There are some sites that expect to unload themselves by setting
    // location.href, and upon setting that property, put themselves into
    // a semi-broken / non-interactive state until the navigation
    // completes.
    //
    // LOAD_FLAGS_STOP_CONTENT is set on the loadType in two cases:
    // 1. When a site sets location.href
    // 2. When a Service Worker attempts to navigate a connected client
    //
    // To fix the issue for location.href, we use this flag as a signal
    // to not delegate the load. This heuristic might be too general, but
    // the failure case of not delegating in these cases seems to be better
    // than delegating.
    let isStopContent = !!(
      loadType &
      (Ci.nsIWebNavigation.LOAD_FLAGS_STOP_CONTENT << 16)
    );

    // We currently let the following things occur within the same BrowsingContext,
    // instead of opening a new one:
    //
    // 1. POST requests
    // 2. Any load that isn't "normal" (in the nsIDocShell.LOAD_CMD_NORMAL sense)
    // 3. Any loads that are caused by location.replace
    // 4. Any loads that were caused by setting location.href, or from a
    //    Service Worker.
    if (hasPostData || !isNormalLoad || isHistoryReplace || isStopContent) {
      return true;
    }

    // Many of our tests expect a browser navigation to result in the load occurring
    // in the same browser. This means that the TopLevelNavigationDelegate breaks
    // those tests when it creates new <browser> elements that the tests didn't
    // originally anticipate. We workaround this problem for now by not delegating
    // when the System Principal initiated the load. In the future, we should
    // investigate migrating our tests to be able to withstand a delegation and
    // the creation of a new <browser>.
    if (
      triggeringPrincipal == Services.scriptSecurityManager.getSystemPrincipal()
    ) {
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
        referrerInfo: E10SUtils.serializeReferrerInfo(referrerInfo),
      });
      return false;
    }

    return true;
  }
}

TopLevelNavigationDelegateChild.prototype.QueryInterface = ChromeUtils.generateQI(
  ["nsITopLevelNavigationDelegate"]
);
