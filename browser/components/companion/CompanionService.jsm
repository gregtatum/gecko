/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["CompanionService"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);

if (!AppConstants.PINEBUILD) {
  throw new Error(
    "We should not be importing the CompanionService if pinebuild is not enabled."
  );
}

XPCOMUtils.defineLazyModuleGetters(this, {
  Services: "resource://gre/modules/Services.jsm",
});

const CompanionService = {
  init() {
    if (this.inited) {
      return;
    }
    this.inited = true;

    let registrar = Components.manager.QueryInterface(Ci.nsIComponentRegistrar);
    registrar.registerFactory(
      ChromeURLBlockPolicy.classID,
      ChromeURLBlockPolicy.classDescription,
      ChromeURLBlockPolicy.contractID,
      ChromeURLBlockPolicy
    );

    Services.catMan.addCategoryEntry(
      "content-policy",
      ChromeURLBlockPolicy.contractID,
      ChromeURLBlockPolicy.contractID,
      false,
      true
    );
  },

  hideCompanionToolbar(aWindow) {
    let companionToolbar = aWindow.document.getElementById("pinebuild-toolbar");
    companionToolbar.setAttribute("hidden", "true");
  },

  showCompanionToolbar(aWindow) {
    let companionToolbar = aWindow.document.getElementById("pinebuild-toolbar");
    companionToolbar.removeAttribute("hidden");
  },

  copy(anchor, string) {
    let clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
      Ci.nsIClipboardHelper
    );
    clipboard.copyString(string);
    anchor.ownerGlobal.ConfirmationHint.show(anchor, "copyURL");
  },
};

let ChromeURLBlockPolicy = {
  shouldLoad(contentLocation, loadInfo, mimeTypeGuess) {
    let contentType = loadInfo.externalContentPolicyType;
    if (
      (contentLocation.scheme != "chrome" &&
        contentLocation.scheme != "about") ||
      (contentType != Ci.nsIContentPolicy.TYPE_DOCUMENT &&
        contentType != Ci.nsIContentPolicy.TYPE_SUBDOCUMENT)
    ) {
      return Ci.nsIContentPolicy.ACCEPT;
    }
    if (contentLocation.spec.startsWith("about:addons")) {
      return Ci.nsIContentPolicy.REJECT_REQUEST;
    }
    return Ci.nsIContentPolicy.ACCEPT;
  },
  shouldProcess(contentLocation, loadInfo, mimeTypeGuess) {
    return Ci.nsIContentPolicy.ACCEPT;
  },
  classDescription: "Pinebuild Content Policy",
  contractID: "@mozilla-org/pinebuild-content-policy-service;1",
  classID: Components.ID("{ba7b9118-cabc-4845-8b26-4215d2a59ed8}"),
  QueryInterface: ChromeUtils.generateQI(["nsIContentPolicy"]),
  createInstance(outer, iid) {
    return this.QueryInterface(iid);
  },
};
