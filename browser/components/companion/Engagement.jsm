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
  setInterval: "resource://gre/modules/Timer.jsm",
  clearInterval: "resource://gre/modules/Timer.jsm",
});

XPCOMUtils.defineLazyGetter(this, "log", () => {
  let { ConsoleAPI } = ChromeUtils.import("resource://gre/modules/Console.jsm");
  return new ConsoleAPI({
    prefix: "Engagement",
    maxLogLevel: "debug",
  });
});

const PASSIVE_ENGAGEMENT_TIMER = 10 * 1000; // 10 seconds
const ACTIVE_ENGAGEMENT_TIMER = 2 * 1000; // 10 seconds

const DOMWINDOW_OPENED_TOPIC = "domwindowopened";

let Engagement = {
  _engagements: new Map(),

  _currentURL: null,

  _delayedEngagements: new Map(),

  _inited: false,

  init() {
    this._setupAfterRestore();
    this._inited = true;
    this.startEngagementTimer();
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
    this.stopEngagementTimer();
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
          let tab = event.target;
          if (!this.isHttpURI(tab.linkedBrowser.currentURI)) {
            return;
          }
          let url = tab.linkedBrowser.currentURI.specIgnoringRef;
          if (!this._engagements.has(url)) {
            this.engage({ url });
          }
          this._currentURL = tab.linkedBrowser.currentURI.specIgnoringRef;
        }
        break;
      case "activate":
        if (event.target instanceof Ci.nsIDOMWindow) {
          let win = event.target;
          if (win.gBrowser) {
            this.startEngagementTimer();
          }
        }
        break;
      case "deactivate":
        if (event.target instanceof Ci.nsIDOMWindow) {
          let win = event.target;
          if (win.gBrowser) {
            this.stopEngagementTimer();
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

  _engagementTimer: 0,
  startEngagementTimer() {
    if (this._engagementTimer == 0) {
      this._engagementTimer = setInterval(this.processEngagements, 1000);
    }
  },

  stopEngagementTimer() {
    clearInterval(this._engagementTimer);
    this._engagementTimer = 0;
  },

  async processEngagements() {
    Engagement._engagements.forEach(function(engagementData, url) {
      if (Engagement._currentURL == url) {
        engagementData.lastTimeOnPage = new Date().getTime();
        engagementData.totalEngagement += 1000;
        if (engagementData.addedKeyframe) {
          return;
        }
        let engagementTimer =
          engagementData.type == "automatic"
            ? PASSIVE_ENGAGEMENT_TIMER
            : ACTIVE_ENGAGEMENT_TIMER;
        if (engagementData.totalEngagement > engagementTimer) {
          engagementData.addedKeyframe = true;
          log.debug(`Adding ${url} to database`);
          Keyframes.addOrUpdate(
            url,
            engagementData.type,
            engagementData.startTimeOnPage,
            engagementData.lastTimeOnPage,
            // totalEngagement will be added when the page is unloaded
            0
          );
        }
        Engagement._engagements.set(url, engagementData);
      }
    });
  },

  async engage(msg) {
    let uri = Services.io.newURI(msg.url);
    if (!this.isHttpURI(uri)) {
      return;
    }
    let url = uri.specIgnoringRef;
    let engagementData = this._engagements.get(url);
    if (engagementData) {
      engagementData.engagedPages += 1;
    } else {
      let type = this._delayedEngagements.get(url) || "automatic";
      this._delayedEngagements.delete(url);
      engagementData = {
        type,
        startTimeOnPage: new Date().getTime(),
        lastTimeOnPage: new Date().getTime(),
        totalEngagement: 0,
        engagedPages: 1,
      };
    }
    this._engagements.set(url, engagementData);

    this._currentURL = url;
  },

  async disengage(msg) {
    let uri = Services.io.newURI(msg.url);
    if (!this.isHttpURI(uri)) {
      return;
    }
    let url = uri.specIgnoringRef;
    let engagementData = Engagement._engagements.get(url);
    if (engagementData) {
      if (engagementData.engagedPages == 1) {
        if (engagementData.addedKeyframe) {
          log.debug(`Updating ${url} in database`);
          Keyframes.addOrUpdate(
            url,
            "automatic",
            engagementData.startTimeOnPage,
            engagementData.lastTimeOnPage,
            engagementData.totalEngagement
          );
        }
        this._engagements.delete(url);
      } else {
        engagementData.engagedPages -= 1;
        this._engagements.set(url, engagementData);
      }
    }

    if (this._currentURL == url) {
      this.currentURL = null;
    }
  },

  /* In case where we know we want to add a URL to Keyframes
   without engagement (yet), we use this function so that
   we can keep track of URLs we need to add.
  */
  async delayEngage(url, type) {
    let uri = Services.io.newURI(url);
    if (!this.isHttpURI(uri)) {
      return;
    }
    url = uri.specIgnoringRef;
    this._delayedEngagements.set(url, type);
  },
};
