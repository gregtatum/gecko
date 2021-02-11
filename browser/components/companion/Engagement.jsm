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
  setTimeout: "resource://gre/modules/Timer.jsm",
  clearTimeout: "resource://gre/modules/Timer.jsm",
});

XPCOMUtils.defineLazyGetter(this, "log", () => {
  let { ConsoleAPI } = ChromeUtils.import("resource://gre/modules/Console.jsm");
  return new ConsoleAPI({
    prefix: "Engagement",
    maxLogLevel: "debug",
  });
});

const DOMWINDOW_OPENED_TOPIC = "domwindowopened";

const ENGAGEMENT_TIMER = 5 * 1000; // 10 seconds

let Engagement = {
  _currentTimer: null,
  _currentURL: null,

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
          let tab = event.target;
          this.clearEngagementTimerIf();
          this.startEngagementTimer(tab.linkedBrowser.currentURI);
        }
        break;
      case "focus":
        var win = event.target;
        if (event.target instanceof Ci.nsIDOMWindow) {
          if (win.defaultView) {
            let tab = win.defaultView.gBrowser.selectedTab;
            this.startEngagementTimer(tab.linkedBrowser.currentURI);
          }
        }
        break;
      case "blur":
        if (event.target instanceof Ci.nsIDOMWindow) {
          this.clearEngagementTimerIf();
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
    win.addEventListener("blur", this, true);
    win.addEventListener("focus", this, true);
  },

  _unregisterWindow(win) {
    win.removeEventListener("TabSelect", this, true);
    win.removeEventListener("blur", this, true);
    win.removeEventListener("focus", this, true);
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

  startTimer(msg) {
    if (this._currentURL != msg.url) {
      this.clearEngagementTimerIf();
      this._currentURL = null;
      this.startEngagementTimer(Services.io.newURI(msg.url));
      this._currentURL = msg._currentURL;
    }
  },
  isHttpURI(uri) {
    // Only consider http(s) schemas.
    return uri.schemeIs("http") || uri.schemeIs("https");
  },

  clearEngagementTimerIf() {
    if (this._currentTimer) {
      log.debug("Clearing timer " + this._currentTimer);
      clearTimeout(this._currentTimer);
      this._currentTimer = null;
    }
  },

  startEngagementTimer(uri) {
    if (!this.isHttpURI(uri)) {
      return;
    }
    this._currentTimer = setTimeout(function() {
      log.debug("ENGAGED WITH:" + uri.specIgnoringRef);
      Keyframes.add(uri.specIgnoringRef, "automatic");
      Engagement._currentTimer = null;
    }, ENGAGEMENT_TIMER);
    log.debug(
      "started timer " + this._currentTimer + " for " + uri.specIgnoringRef
    );
  },
};
