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
const { E10SUtils } = ChromeUtils.import(
  "resource://gre/modules/E10SUtils.jsm"
);

if (!AppConstants.PROCLIENT_ENABLED) {
  throw new Error(
    "We should not be importing the CompanionService if procient is not enabled."
  );
}

XPCOMUtils.defineLazyModuleGetters(this, {
  Services: "resource://gre/modules/Services.jsm",
});

const COMPANION_OPEN_PREF = "companion.open";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

class BrowserWindowHandler {
  constructor(window) {
    this.window = window;
    this.selectedTab = window.gBrowser.selectedTab;
    this._companionBox = this.window.document.getElementById("companion-box");

    let companionToolbar = this.window.document.getElementById(
      "companion-toolbar"
    );
    let activeViewManager = this.window.document.createElement(
      "active-view-manager"
    );
    companionToolbar.appendChild(activeViewManager);

    //    let lock = this.window.document.getElementById("identity-box");
    //    let companionIdentityBox = this.window.document.getElementById(
    //    "companion-identity-box"
    //  );
    //  companionIdentityBox.appendChild(lock);

    Services.prefs.addObserver(COMPANION_OPEN_PREF, this);

    window.addEventListener("unload", () => this.destroy(), { once: true });
    this.observe();

    this.selectedTab.addEventListener("TabAttrModified", () => {
      this.updateTab();
    });
    window.gBrowser.addEventListener("TabSelect", () => {
      this.updateTab();
    });
    window.gBrowser.addProgressListener(this);
    this.updateTab();
  }

  updateTab() {
    if (this.selectedTab != this.window.gBrowser.selectedTab) {
      // If the selected tab has changed, unregister the event listener
      // for the previously selected tab and register a new one
      // for the currently selected tab.
      this.selectedTab.removeEventListener("TabAttrModified", this);
      this.selectedTab = this.window.gBrowser.selectedTab;
      this.selectedTab.addEventListener("TabAttrModified", () => {
        this.updateTab();
      });
    }
  }

  destroy() {
    Services.prefs.removeObserver(COMPANION_OPEN_PREF, this);
    let xulStore = Services.xulStore;
    xulStore.persist(this._companionBox, "width");

    CompanionService.removeWindow(this);
  }

  observe() {
    this.window.document.documentElement.setAttribute("companion", "true");
    let browser = this.window.document.getElementById("companion-browser");
    if (browser) {
      return;
    }

    browser = this.window.document.createElementNS(XUL_NS, "browser");
    browser.setAttribute(
      "src",
      "chrome://browser/content/companion/companion.xhtml"
    );
    browser.setAttribute("id", "companion-browser");
    browser.setAttribute("disablehistory", "true");
    browser.setAttribute("autoscroll", "false");
    browser.setAttribute("selectmenulist", "ContentSelectDropdown");
    browser.setAttribute("disablefullscreen", "true");
    browser.setAttribute("flex", "1");
    browser.setAttribute("remoteType", E10SUtils.PRIVILEGEDABOUT_REMOTE_TYPE);
    browser.setAttribute("remote", "true");
    browser.setAttribute("message", "true");
    browser.setAttribute("messagemanagergroup", "browsers");
    browser.setAttribute("type", "content");

    this.window.document.getElementById("companion-box").appendChild(browser);
  }

  onLocationChange(aWebProgress, aRequest, aLocationURI, aFlags, aIsSimulated) {
    this.updateTab();
  }

  QueryInterface = ChromeUtils.generateQI([
    "nsIWebProgressListener",
    "nsIWebProgressListener2",
    "nsISupportsWeakReference",
  ]);
}

const CompanionService = {
  init() {
    if (this.inited) {
      return;
    }
    this.inited = true;

    this._windows = new Set();

    this.openCompanion();
  },

  addBrowserWindow(window) {
    this._windows.add(new BrowserWindowHandler(window));
  },

  removeWindow(browserWindow) {
    this._windows.delete(browserWindow);
  },

  get isOpen() {
    return Services.prefs.getBoolPref(COMPANION_OPEN_PREF, true);
  },

  toggleCompanion() {
    if (this.isOpen) {
      this.closeCompanion();
    } else {
      this.openCompanion();
    }
  },

  openCompanion() {
    Services.prefs.setBoolPref(COMPANION_OPEN_PREF, true);
  },

  closeCompanion() {
    Services.prefs.setBoolPref(COMPANION_OPEN_PREF, false);
  },

  copy(anchor, string) {
    let clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"].getService(
      Ci.nsIClipboardHelper
    );
    clipboard.copyString(string);
    anchor.ownerGlobal.ConfirmationHint.show(anchor, "copyURL");
  },
};

CompanionService.init();

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
  classDescription: "MR2 Content Policy",
  contractID: "@mozilla-org/mr2-content-policy-service;1",
  classID: Components.ID("{ba7b9118-cabc-4845-8b26-4215d2a59ed8}"),
  QueryInterface: ChromeUtils.generateQI(["nsIContentPolicy"]),
  createInstance(outer, iid) {
    return this.QueryInterface(iid);
  },
};

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
