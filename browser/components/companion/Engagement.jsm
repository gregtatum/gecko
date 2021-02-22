/* -*- js-indent-level: 2; indent-tabs-mode: nil -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["Engagement"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  //  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
  Keyframes: "resource:///modules/Keyframes.jsm",
  Services: "resource://gre/modules/Services.jsm",
});

XPCOMUtils.defineLazyGetter(this, "log", () => {
  let { ConsoleAPI } = ChromeUtils.import("resource://gre/modules/Console.jsm");
  return new ConsoleAPI({
    prefix: "Engagement",
    maxLogLevel: "debug",
  });
});

const DOMWINDOW_OPENED_TOPIC = "domwindowopened";

let Engagement = {
  _currentURL: null,
  _startTimeOnPage: 0,

  _thumbnails: new Map(),

  _inited: false,

  init() {
    this._setupAfterRestore();
    this._inited = true;
  },

  QueryInterface: ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]),

  uninit() {
    if (!this._inited) {
      return;
    }
    Services.obs.removeObserver(this, DOMWINDOW_OPENED_TOPIC);
  },

  observe(subject, topic, data) {
    switch (topic) {
      case DOMWINDOW_OPENED_TOPIC:
        this._onWindowOpen(subject);
        break;
    }
  },

  handleEvent(event) {
    switch (event.type) {
      case "TabSelect":
        {
          this.disengage({ url: this._currentURL });
          let tab = event.target;
          this.engage({ url: tab.linkedBrowser.currentURI.specIgnoringRef });
        }
        break;
      case "activate":
        // We only want to start timers for focus events for the whole window
        if (event.target instanceof Ci.nsIDOMWindow) {
          let win = event.target;
          if (win.gBrowser) {
            let tab = win.gBrowser.selectedTab;
            this.engage({ url: tab.linkedBrowser.currentURI.specIgnoringRef });
          }
        }
        break;
      case "deactivate":
        if (event.target instanceof Ci.nsIDOMWindow) {
          let win = event.target;
          if (win.gBrowser) {
            let tab = win.gBrowser.selectedTab;
            this.disengage({
              url: tab.linkedBrowser.currentURI.specIgnoringRef,
            });
          }
        }
        break;
      case "unload":
        this._unregisterWindow(event.target);
        break;
    }
  },

  /**
   * This gets called shortly after the SessionStore has finished restoring
   * windows and tabs. It counts the open tabs and adds listeners to all the
   * windows.
   */
  _setupAfterRestore() {
    // Make sure to catch new chrome windows and subsession splits.
    Services.obs.addObserver(this, DOMWINDOW_OPENED_TOPIC, true);

    // Attach the tabopen handlers to the existing Windows.
    for (let win of Services.wm.getEnumerator("navigator:browser")) {
      this._registerWindow(win);
    }
  },

  _registerWindow(win) {
    win.addEventListener("TabSelect", this, true);
    win.addEventListener("deactivate", this, true);
    win.addEventListener("activate", this, true);
  },

  _unregisterWindow(win) {
    win.removeEventListener("TabSelect", this, true);
    win.removeEventListener("deactivate", this, true);
    win.removeEventListener("activate", this, true);
  },

  _onWindowOpen(win) {
    // Make sure to have a |nsIDOMWindow|.
    if (!(win instanceof Ci.nsIDOMWindow)) {
      return;
    }

    let onLoad = () => {
      win.removeEventListener("load", onLoad);

      // Ignore non browser windows.
      if (
        win.document.documentElement.getAttribute("windowtype") !=
        "navigator:browser"
      ) {
        return;
      }

      this._registerWindow(win);
    };
    win.addEventListener("load", onLoad);
  },

  reportError(msg) {
    log.debug(JSON.stringify(msg));
  },

  isHttpURI(uri) {
    // Only consider http(s) schemas.
    return uri.schemeIs("http") || uri.schemeIs("https");
  },

  engage(msg) {
    log.debug("engage with " + msg.url);
    this._currentURL = msg.url;
    if ("thumbnail" in msg) {
      this._thumbnails.set(msg.url, msg.thumbnail);
    }
    this._startTimeOnPage = new Date().getTime();
  },

  async disengage(msg) {
    log.debug("disengage with " + msg.url);
    let stopTimeOnPage = new Date().getTime();
    let timeOnPage = new Date().getTime() - this._startTimeOnPage;
    log.debug(timeOnPage / 1000 + " seconds of engagement");
    await Keyframes.addOrUpdate(
      Services.io.newURI(msg.url).specIgnoringRef,
      "automatic",
      this._startTimeOnPage,
      stopTimeOnPage,
      timeOnPage,
      this._thumbnails.get(msg.url)
    );
    this._thumbnails.delete(msg.url);
    this._currentURL = null;
  },
};
