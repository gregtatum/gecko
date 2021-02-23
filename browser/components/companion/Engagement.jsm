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
  _docInfos: new Map(),
  _delayedEngagements: new Map(),

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

  /* If a page is loaded in the background, we store the
     document information in case we need it later. */
  updateThumbnail(msg) {
    if (!this.isHttpURI(Services.io.newURI(msg.url))) {
      return;
    }
    /*
    if (msg.thumbnail) {
      let url = msg.canonicalURL || Services.io.newURI(msg.url).specIgnoringRef;
      this._thumbnails.set(url, msg.thumbnail);
      Keyframes.updateThumbnail(url, msg.thumbnail);
    }
    if (msg.canonicalURL) {
    */
    this._docInfos.set(msg.url, msg);
    /*
    }
    */
  },

  async engage(msg) {
    if (!this.isHttpURI(Services.io.newURI(msg.url))) {
      return;
    }
    log.debug("engage with " + msg.url);
    this._currentURL = msg.url;
    // Anytime a page is loaded, we update the thumbnail just in case it changed.
    if ("thumbnail" in msg) {
      Keyframes.updateThumbnail(msg.url, msg.thumbnail);
    }
    this._startTimeOnPage = new Date().getTime();
    /* This page was loaded as a result of a user action. Add it to the
       keyframe database immediately. */
    if (this._delayedEngagements.has(msg.url)) {
      let type = this._delayedEngagements.get(msg.url);
      await Keyframes.addOrUpdate(
        msg.url,
        type,
        this._startTimeOnPage,
        this._startTimeOnPage,
        0,
        msg.thumbnail
      );
      this._delayedEngagements.delete(msg.url);
    }
  },

  async disengage(msg) {
    if (
      !this.isHttpURI(Services.io.newURI(msg.url)) ||
      !this._startTimeOnPage ||
      msg.url != this._currentURL
    ) {
      return;
    }
    if (this._docInfos.has(msg.url)) {
      msg = this._docInfos.get(msg.url);
    }
    log.debug("disengage with " + msg.url);
    let stopTimeOnPage = new Date().getTime();
    let timeOnPage = new Date().getTime() - this._startTimeOnPage;
    log.debug(timeOnPage / 1000 + " seconds of engagement");
    await Keyframes.addOrUpdate(
      msg.url,
      "automatic",
      this._startTimeOnPage,
      stopTimeOnPage,
      timeOnPage,
      msg.thumbnail
    );
    this._currentURL = null;
  },

  /* In case where we know we want to add a URL to Keyframes
   without engagement (yet), we use this function so that
   we can keep track of URLs we need to add.
  */
  async delayEngage(url, type) {
    this._delayedEngagements.set(url, type);
  },
};
