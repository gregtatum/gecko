/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["CompanionService"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  Services: "resource://gre/modules/Services.jsm",
  MuxerUnifiedComplete: "resource:///modules/UrlbarMuxerUnifiedComplete.jsm",
  UrlbarProvidersManager: "resource:///modules/UrlbarProvidersManager.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
});

const COMPANION_DOCKED_PREF = "companion.docked";
const COMPANION_OPEN_PREF = "companion.open";
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

class CompanionWindowMuxer extends MuxerUnifiedComplete {
  get name() {
    return "companion";
  }

  sort(queryContext) {
    super.sort(queryContext);

    let switchEntry = queryContext.results.findIndex(
      entry => entry.type == UrlbarUtils.RESULT_TYPE.TAB_SWITCH
    );

    if (switchEntry >= 0) {
      let [entry] = queryContext.results.splice(switchEntry, 1);
      queryContext.results.unshift(entry);
    }
  }
}

class BrowserWindowHandler {
  constructor(window) {
    this.window = window;
    Services.prefs.addObserver(COMPANION_OPEN_PREF, this);
    Services.prefs.addObserver(COMPANION_DOCKED_PREF, this);

    window.addEventListener("unload", () => this.destroy(), { once: true });
    this.observe();

    window.gBrowser.addEventListener("TabAttrModified", () => {
      this.updateTab();
    });
    window.gBrowser.addEventListener("TabSelect", () => {
      this.updateTab();
    });
    window.gBrowser.addProgressListener(this);
    this.updateTab();
  }

  updateTab() {
    let title = this.window.gBrowser.selectedTab.getAttribute("label");
    this.window.document.getElementById("companion-page-title").value = title;
    this.window.document.getElementById(
      "companion-page-title"
    ).tooltipText = title;

    let domain = "";

    try {
      domain = this.window.gBrowser.currentURI.host;
    } catch (e) {
      // about page.
    }
    this.window.document.getElementById("companion-page-domain").value = domain;
  }

  destroy() {
    Services.prefs.removeObserver(COMPANION_OPEN_PREF, this);
    Services.prefs.removeObserver(COMPANION_DOCKED_PREF, this);

    CompanionService.removeWindow(this);
  }

  observe() {
    let docked = CompanionService.isDocked && CompanionService.isOpen;

    if (docked) {
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
      browser.setAttribute("disablefullscreen", "true");
      browser.setAttribute("flex", "1");

      this.window.document.getElementById("companion-box").appendChild(browser);
    } else {
      this.window.document.documentElement.removeAttribute("companion");
      this.window.document.getElementById("companion-browser")?.remove();
    }
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

    UrlbarProvidersManager.registerMuxer(new CompanionWindowMuxer());

    this._windows = new Set();

    this.openCompanion();
  },

  addBrowserWindow(window) {
    this._windows.add(new BrowserWindowHandler(window));
  },

  removeWindow(browserWindow) {
    this._windows.delete(browserWindow);

    if (this._windows.size == 0) {
      this.closeCompanionWindow();
    }
  },

  get isDocked() {
    return Services.prefs.getBoolPref(COMPANION_DOCKED_PREF, true);
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

  toggleDocked() {
    if (this.isDocked) {
      this.undockCompanion();
    } else {
      this.dockCompanion();
    }
  },

  openCompanion() {
    if (!this.isDocked) {
      this.openCompanionWindow();
    }

    Services.prefs.setBoolPref(COMPANION_OPEN_PREF, true);
  },

  closeCompanion() {
    if (!this.isDocked) {
      this.closeCompanionWindow();
    }

    Services.prefs.setBoolPref(COMPANION_OPEN_PREF, false);
  },

  dockCompanion() {
    this.closeCompanionWindow();

    Services.prefs.setBoolPref(COMPANION_DOCKED_PREF, true);

    this.openCompanion();
  },

  undockCompanion() {
    Services.prefs.setBoolPref(COMPANION_DOCKED_PREF, false);

    this.openCompanion();
  },

  openCompanionWindow() {
    let companion = Services.wm.getMostRecentWindow("Firefox:Companion");

    if (companion && !companion.closed) {
      companion.focus();
      return;
    }

    let win = Services.ww.openWindow(
      null,
      "chrome://browser/content/companion/companion.xhtml",
      "_blank",
      "chrome,all,dialog=no,resizable=yes,toolbar=yes",
      null
    );

    win.addEventListener(
      "unload",
      () => {
        if (!this.isDocked && this._windows.size > 0) {
          Services.prefs.setBoolPref(COMPANION_OPEN_PREF, false);
        }
      },
      { once: true }
    );
  },

  closeCompanionWindow() {
    let companion = Services.wm.getMostRecentWindow("Firefox:Companion");
    if (companion && !companion.closed) {
      companion.close();
    }
  },

  dockAndToggle() {
    if (this.isOpen) {
      this.closeCompanion();
    } else {
      this.dockCompanion();
    }
  },
};

CompanionService.init();
