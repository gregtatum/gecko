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

const PASSIVE_ENGAGEMENT_TIMER = 30 * 1000; // 30 seconds
const ACTIVE_ENGAGEMENT_TIMER = 10 * 1000; // 10 seconds
const ENGAGEMENT_TIMER_INTERVAL = 1000;

const DOMWINDOW_OPENED_TOPIC = "domwindowopened";

let Engagement = {
  _engagements: new Map(),

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
          let contextId = tab.linkedBrowser.browsingContext.id;
          let engagementId = `${contextId}: ${url}`;
          log.debug(`Switch to id ${engagementId}`);
          if (!this._engagements.has(engagementId)) {
            this.engage({ url, contextId });
          }
          this._currentContextId = contextId;
        }
        break;
      case "activate":
        if (event.target instanceof Ci.nsIDOMWindow) {
          let win = event.target;
          if (win.gBrowser) {
            this._currentContextId =
              win.gBrowser.selectedTab.linkedBrowser.browsingContext.id;
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
      this._engagementTimer = setInterval(
        this.processEngagements,
        ENGAGEMENT_TIMER_INTERVAL
      );
    }
  },

  stopEngagementTimer() {
    clearInterval(this._engagementTimer);
    this._engagementTimer = 0;
  },

  async processEngagements() {
    let engagementId, engagementData;
    for ([engagementId, engagementData] of Engagement._engagements) {
      if (Engagement._currentContextId == engagementData.contextId) {
        engagementData.lastTimeOnPage = new Date().getTime();
        engagementData.totalEngagement += ENGAGEMENT_TIMER_INTERVAL;
        if (engagementData.id) {
          // Already in database
          return;
        }
        let engagementTimer =
          engagementData.type == "automatic"
            ? PASSIVE_ENGAGEMENT_TIMER
            : ACTIVE_ENGAGEMENT_TIMER;
        if (engagementData.totalEngagement > engagementTimer) {
          log.debug(`Adding ${engagementData.url} to database`);
          engagementData.id = await Keyframes.add(
            engagementData.url,
            engagementData.type,
            engagementData.startTimeOnPage,
            engagementData.lastTimeOnPage,
            // totalEngagement will be added when the page is unloaded
            0
          );
        }
        Engagement._engagements.set(engagementId, engagementData);
      }
    }
  },

  async engage(msg) {
    let uri = Services.io.newURI(msg.url);
    if (!this.isHttpURI(uri)) {
      return;
    }
    let url = uri.specIgnoringRef;
    let contextId = msg.contextId;

    if (contextId == this._currentContextId) {
      // engage without disengage
      // find and disengage
      let engagementId, engagementData;
      // eslint-disable-next-line no-unused-vars
      for ([engagementId, engagementData] of Engagement._engagements) {
        if (Engagement._currentContextId == engagementData.contextId) {
          this.disengage({
            url: engagementData.url,
            contextId: engagementData.contextId,
          });
          break;
        }
      }
    }

    let engagementId = `${contextId}: ${url}`;
    if (!this._engagements.has(engagementId)) {
      let type = this._delayedEngagements.get(url) || "automatic";
      log.debug("engage", type, msg.url);
      this._delayedEngagements.delete(url);
      let engagementData = {
        url,
        type,
        startTimeOnPage: new Date().getTime(),
        lastTimeOnPage: new Date().getTime(),
        totalEngagement: 0,
        contextId,
      };
      this._engagements.set(engagementId, engagementData);
    }

    if (msg.isActive) {
      this._currentContextId = contextId;
    }
  },

  async disengage(msg) {
    let uri = Services.io.newURI(msg.url);
    if (!this.isHttpURI(uri)) {
      return;
    }
    let url = uri.specIgnoringRef;
    let contextId = msg.contextId;
    let engagementId = `${contextId}: ${url}`;

    let engagementData = Engagement._engagements.get(engagementId);
    if (engagementData) {
      if (engagementData.id) {
        log.debug(`Updating ${url} in database`);
        Keyframes.update(
          engagementData.id,
          engagementData.lastTimeOnPage,
          engagementData.totalEngagement
        );
      }
      this._engagements.delete(engagementId);
      if (this._currentContextId == engagementData.contextId) {
        this._currentContextId = 0;
      }
    }
  },

  /* In the case where we know we want to add a URL to Keyframes
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

  /* If we know something is going to be added, use this. */
  async manualEngage(msg) {
    let uri = Services.io.newURI(msg.url);
    if (!this.isHttpURI(uri)) {
      return;
    }
    let url = uri.specIgnoringRef;
    let contextId = msg.contextId;
    let engagementId = `${contextId}: ${url}`;

    let engagementData = this._engagements.get(engagementId);
    if (engagementData.id) {
      Keyframes.updateType(engagementData.id, "manual");
    } else {
      log.debug(`Adding ${url} to database`);
      engagementData.id = await Keyframes.add(
        url,
        "manual",
        engagementData.startTimeOnPage,
        engagementData.lastTimeOnPage,
        // totalEngagement will be added when the page is unloaded
        0
      );
      Engagement._engagements.set(engagementId, engagementData);
    }
  },
};
