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

const ENGAGEMENT_CUTOFF = 2000; // 2 seconds
const ENGAGEMENT_TIMER_INTERVAL = 1000;

const DOMWINDOW_OPENED_TOPIC = "domwindowopened";

let Engagement = {
  _engagements: new WeakMap(),
  _currentEngagement: undefined,

  _delayedEngagements: new Map(),

  _inited: false,

  _lastTimeUpdate: Date.now(),

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

  async updateDb(engagement) {
    if (engagement.id) {
      // Already in the database, update.
      await Keyframes.update(
        engagement.id,
        engagement.lastTimeOnPage,
        engagement.totalEngagement
      );
    } else if (
      engagement.type == "manual" ||
      engagement.totalEngagement >= ENGAGEMENT_CUTOFF
    ) {
      // Need to add to database.
      log.debug(
        "Adding",
        engagement.totalEngagement,
        engagement.type,
        engagement.url
      );
      engagement.id = await Keyframes.add(
        engagement.url,
        engagement.type,
        engagement.startTimeOnPage,
        engagement.lastTimeOnPage,
        engagement.totalEngagement
      );
    }
  },

  updateEngagementTime() {
    let now = Date.now();

    if (this._currentEngagement) {
      let toAdd = now - this._lastTimeUpdate;
      this._currentEngagement.lastTimeOnPage = now;
      this._currentEngagement.totalEngagement += toAdd;

      this.updateDb(this._currentEngagement);
    }

    this._lastTimeUpdate = now;
  },

  handleEvent(event) {
    switch (event.type) {
      case "TabSelect":
        {
          log.debug("Update from tab switch");
          this.updateEngagementTime();

          let tab = event.target;
          if (!this.isHttpURI(tab.linkedBrowser.currentURI)) {
            this._currentEngagement = undefined;
            return;
          }

          this._currentEngagement = this._engagements.get(tab.linkedBrowser);

          if (!this._currentEngagement) {
            // Unknown engagement.
          }
        }
        break;
      case "activate":
        if (event.target instanceof Ci.nsIDOMWindow) {
          let win = event.target;
          if (win.gBrowser) {
            this._currentEngagement = this._engagements.get(
              win.gBrowser.selectedTab.linkedBrowser
            );
            this.startEngagementTimer();
          }
        }
        break;
      case "deactivate":
        if (event.target instanceof Ci.nsIDOMWindow) {
          let win = event.target;
          if (win.gBrowser) {
            log.debug("Update from deactivate");
            this.updateEngagementTime();
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
      this._lastTimeUpdate = Date.now();

      this._engagementTimer = setInterval(
        () => this.updateEngagementTime(),
        ENGAGEMENT_TIMER_INTERVAL
      );
    }
  },

  stopEngagementTimer() {
    clearInterval(this._engagementTimer);
    this._engagementTimer = 0;
  },

  async engage(browser, msg) {
    let uri = Services.io.newURI(msg.url);
    if (!this.isHttpURI(uri)) {
      return;
    }
    let url = uri.specIgnoringRef;

    let engagementData = this._engagements.get(browser);

    if (engagementData && url != engagementData.url) {
      // Already have an engagement for this browser but for a different page.
      if (this._currentEngagement === engagementData) {
        log.debug("Update before new engagement.");
        this.updateEngagementTime();
        this._currentEngagement = undefined;
      }

      // Build a new engagement.
      engagementData = undefined;
    }

    if (!engagementData) {
      let type = this._delayedEngagements.get(url) || "automatic";
      this._delayedEngagements.delete(url);

      engagementData = {
        url,
        type,
        startTimeOnPage: new Date().getTime(),
        lastTimeOnPage: new Date().getTime(),
        totalEngagement: 0,
      };

      this._engagements.set(browser, engagementData);
      this.updateDb(engagementData);
    }

    if (msg.isActive && this._currentEngagement !== engagementData) {
      log.debug("Update before new engagement.");
      this.updateEngagementTime();

      this._currentEngagement = engagementData;
    }
  },

  async disengage(browser) {
    let engagementData = this._engagements.get(browser);

    if (engagementData) {
      engagementData.lastTimeOnPage = Date.now();
      if (this._currentEngagement === engagementData) {
        log.debug("Update from page unload.");
        this.updateEngagementTime();
        this._currentEngagement = undefined;
      } else {
        this.updateDb(engagementData);
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
  async manualEngage(browser) {
    this.updateType(browser, "manual");
  },

  async updateType(browser, type) {
    let engagementData = this._engagements.get(browser);
    if (!engagementData) {
      // Missing engagement.
      return;
    }

    engagementData.type = type;

    log.debug(`Updating type for ${engagementData.url} to ${type}`);

    if (engagementData.id) {
      Keyframes.updateType(engagementData.id, type);
    } else {
      this.updateDb(engagementData);
    }
  },
};
