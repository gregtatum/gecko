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
  DeferredTask: "resource://gre/modules/DeferredTask.jsm",
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

const KEYBOARD_TIMEOUT = 2000; // How long after the last keypress do we consider typing to have ended.

const ENGAGEMENT_CUTOFF = 2000; // 2 seconds
const ENGAGEMENT_TIMER_INTERVAL = 1000;

const DOMWINDOW_OPENED_TOPIC = "domwindowopened";

function isTypingKey(code) {
  if (["Space", "Comma", "Period", "Quote"].includes(code)) {
    return true;
  }

  return (
    code.startsWith("Key") ||
    code.startsWith("Digit") ||
    code.startsWith("Numpad")
  );
}

let Engagement = {
  _engagements: new WeakMap(),  // browser -> {url, type, startTimeOnPage, totalEngagement}
  _currentEngagement: undefined,

  _delayedEngagements: new Map(),

  _inited: false,

  _lastTimeUpdate: Date.now(),

  _inputTimer: new DeferredTask(
    () => Engagement.typingEnded(),
    KEYBOARD_TIMEOUT,
    100
  ),

  _typingStart: null,
  _typingEnd: null,
  _keypresses: 0,

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

  async updateDb(engagement, browser) {
    if (engagement.id) {
      // Already in the database, update.
      await Keyframes.updateEngagement(
        engagement.id,
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
        engagement.totalEngagement
      );

      // Have Fathom categorize the page in the child process, then update the
      // DB entry here. The ideal is to categorize no more than once per page
      // load. I'd like to run it iff it becomes a Keyframe and then only once
      // per load.
      // TODO: Recategorize at some point in case the page content changes.
      // Although, this actually does seem to re-run when we load an old
      // Keyframe from the Companion.
      if (browser && browser.browsingContext) {
        // TODO: I haven't worked out a way of getting a browser object when
        // this is called (indirectly) through init()->startEngagementTimer().
        // This seems to be rare. Nonetheless, we should fix it.
        const category = await browser.browsingContext.currentWindowGlobal
               .getActor("Engagement")
               .sendQuery("Engagement:Categorize",
                          { engagementId: engagement.id });
        Keyframes.updateCategory(engagement.id, category);
      }
    }
  },

  updateEngagementTime(browser) {
    let now = Date.now();

    if (this._currentEngagement) {
      let toAdd = now - this._lastTimeUpdate;
      this._currentEngagement.totalEngagement += toAdd;
      this.updateDb(this._currentEngagement, browser);
    }

    this._lastTimeUpdate = now;
  },

  handleEvent(event) {
    switch (event.type) {
      case "TabSelect":
        {
          log.debug("Update from tab switch");
          let tab = event.target;
          this.updateEngagementTime(tab.linkedBrowser);
          this.typingEnded();

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
            this.startEngagementTimer(win.gBrowser.selectedTab.linkedBrowser);
          }
        }
        break;
      case "deactivate":
        if (event.target instanceof Ci.nsIDOMWindow) {
          let win = event.target;
          if (win.gBrowser) {
            log.debug("Update from deactivate");
            this.updateEngagementTime(win.gBrowser.selectedTab.linkedBrowser);
            this.typingEnded();
            this.stopEngagementTimer();
          }
        }
        break;
      case "unload":
        this._unregisterWindow(event.target);
        break;
      case "keyup":
        if (
          event.target.ownerGlobal.gBrowser?.selectedBrowser == event.target &&
          isTypingKey(event.code)
        ) {
          this._keypresses++;
          if (!this._typingStart) {
            this._typingStart = Date.now();
          }
          this._typingEnd = Date.now();
          this._inputTimer.disarm();
          this._inputTimer.arm();
        }
        break;
    }
  },

  typingEnded() {
    this._inputTimer.disarm();

    // We don't consider a single keystroke to be typing, not least because it would have 0 typing
    // time which would equate to infinite keystrokes per minute.
    if (
      this._keypresses > 1 &&
      this._currentEngagement &&
      this._currentEngagement.id
    ) {
      let typingTime = this._typingEnd - this._typingStart;
      Keyframes.updateKeypresses(
        this._currentEngagement.id,
        typingTime,
        this._keypresses
      );
    }

    this._keypresses = 0;
    this._typingStart = null;
    this._typingEnd = null;
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
    Services.els.addSystemEventListener(win.document, "keyup", this, false);
  },

  _unregisterWindow(win) {
    win.removeEventListener("TabSelect", this, true);
    win.removeEventListener("deactivate", this, true);
    win.removeEventListener("activate", this, true);
    Services.els.removeSystemEventListener(win.document, "keyup", this, false);
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
  startEngagementTimer(browser) {
    if (this._engagementTimer == 0) {
      this._lastTimeUpdate = Date.now();

      this._engagementTimer = setInterval(
        () => this.updateEngagementTime(browser),
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
        this.updateEngagementTime(browser);
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
        totalEngagement: 0,
      };

      this._engagements.set(browser, engagementData);
      this.updateDb(engagementData, browser);
    }

    if (msg.isActive && this._currentEngagement !== engagementData) {
      log.debug("Update before new engagement.");
      this.updateEngagementTime(browser);

      this._currentEngagement = engagementData;
    }
  },

  async disengage(browser) {
    let engagementData = this._engagements.get(browser);

    if (engagementData) {
      if (this._currentEngagement === engagementData) {
        log.debug("Update from page unload.");
        this.updateEngagementTime(browser);
        this.typingEnded();
        this._currentEngagement = undefined;
      } else {
        this.updateDb(engagementData, browser);
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
      this.updateDb(engagementData, browser);
    }
  },
};
