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
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
  Keyframes: "resource:///modules/Keyframes.jsm",
  Services: "resource://gre/modules/Services.jsm",
  setTimeout: "resource://gre/modules/Timer.jsm",
  clearTimeout: "resource://gre/modules/Timer.jsm",
});

const DOMWINDOW_OPENED_TOPIC = "domwindowopened";

const ENGAGEMENT_TIMER = 5 * 1000; // 10 seconds

let EngagementListener = {
  _currentTimer: null,
  _currentURL: null,

  isHttpURI(uri) {
    // Only consider http(s) schemas.
    return uri.schemeIs("http") || uri.schemeIs("https");
  },

  // DETERMINE LATER IF onStageChange is better than onLocationChange
  /*
  onStateChange(browser, webProgress, request, stateFlags, status) {
    if (
      !webProgress.isTopLevel ||
      !(stateFlags & Ci.nsIWebProgressListener.STATE_STOP) ||
      !(stateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW)
    ) {
      return;
    }

    if (!(request instanceof Ci.nsIChannel) || !this.isHttpURI(request.URI)) {
      return;
    }

//    Components.utils.reportError("state:" + request.originalURI.specIgnoringRef);
  },
*/

  onLocationChange(browser, webProgress, request, uri, flags) {
    // Don't count this URI if it's an error page.
    if (flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_ERROR_PAGE) {
      return;
    }

    // Don't count non https URLs
    if (!this.isHttpURI(uri)) {
      return;
    }

    // We only care about top level loads.
    if (!webProgress.isTopLevel) {
      return;
    }

    // The SessionStore sets the URI of a tab first, firing onLocationChange the
    // first time, then manages content loading using its scheduler. Once content
    // loads, we will hit onLocationChange again.
    // We can catch the first case by checking for null requests: be advised that
    // this can also happen when navigating page fragments, so account for it.
    if (
      !request &&
      !(flags & Ci.nsIWebProgressListener.LOCATION_CHANGE_SAME_DOCUMENT)
    ) {
      return;
    }

    if (PrivateBrowsingUtils.isWindowPrivate(browser.ownerGlobal)) {
      return;
    }

    if (this._currentURL != uri.specIgnoringRef) {
      this.clearEngagementTimerIf();
      EngagementListener._currentURL = null;
      this.startEngagementTimer(uri);
      this._currentURL = uri.specIgnoringRef;
    }
  },

  QueryInterface: ChromeUtils.generateQI([
    "nsIWebProgressListener",
    "nsISupportsWeakReference",
  ]),

  clearEngagementTimerIf() {
    if (this._currentTimer) {
      clearTimeout(this._currentTimer);
      this._currentTimer = null;
    }
  },

  startEngagementTimer(uri) {
    if (!this.isHttpURI(uri)) {
      return;
    }
    this._currentTimer = setTimeout(function() {
      Cu.reportError("ENGAGED WITH:" + uri.specIgnoringRef);
      Keyframes.add(uri.specIgnoringRef);
    }, ENGAGEMENT_TIMER);
  },
};

let Engagement = {
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
          EngagementListener.clearEngagementTimerIf();
          EngagementListener.startEngagementTimer(tab.linkedBrowser.currentURI);
        }
        break;
      case "focus":
        var win = event.target;
        if (win.defaultView) {
          let tab = win.defaultView.gBrowser.selectedTab;
          EngagementListener.startEngagementTimer(tab.linkedBrowser.currentURI);
        }
        break;
      case "blur":
        if (event.target instanceof Ci.nsIDOMWindow) {
          EngagementListener.clearEngagementTimerIf();
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
    win.gBrowser.addTabsProgressListener(EngagementListener);
  },

  _unregisterWindow(win) {
    win.removeEventListener("TabSelect", this, true);
    win.removeEventListener("blur", this, true);
    win.removeEventListener("focus", this, true);
    win.defaultView.gBrowser.removeTabsProgressListener(EngagementListener);
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
};
