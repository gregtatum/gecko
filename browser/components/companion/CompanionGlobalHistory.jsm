/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["CompanionGlobalHistory"];

var { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

ChromeUtils.import("resource://gre/modules/NotificationDB.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
  SessionStore: "resource:///modules/sessionstore/SessionStore.jsm",
});

XPCOMUtils.defineLazyGetter(this, "log", () => {
  return console.createInstance({
    prefix: "CompanionGlobalHistory",
    maxLogLevel: "Debug",
  });
});

const HISTORY_STATE = new WeakMap();

const progressListener = {
  onStateChange(aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {
    log.debug(
      "onStateChange: aStateFlags & STATE_RESTORING is ",
      aStateFlags & Ci.nsIWebProgressListener.STATE_RESTORING,
      "onStateChange: aStateFlags & STATE_IS_NETWORK is ",
      aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK
    );

    let window = aBrowser.ownerGlobal;
    let state = HISTORY_STATE.get(window);
    if (!state) {
      log.error("onStateChange: unknown window");
      return;
    }

    // Don't record state changes unless it's a top-level page that is done
    // loading and was a success.
    // (Copypasta'd from browser/components/fxmonitor/FirefoxMonitor.jsm#261)
    if (
      !(aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) ||
      !aWebProgress.isTopLevel ||
      aWebProgress.isLoadingDocument ||
      // TODO not sure about this last one. Do we want to keep 404s in history?
      !Components.isSuccessCode(aStatus)
    ) {
      return;
    }

    // Don't add back/forward visits to history, otherwise we'll wind up
    // resetting _historyDepth to 0 and losing our place in history.
    //
    // TODO the STATE_RESTORING check isn't always seem reliable; adding some
    // logging to try to understand when it fails.
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_RESTORING) {
      log.debug(
        "onStateChange: STATE_RESTORING detected, not adding this visit to history."
      );
      return;
    }

    // Exclude about: pages related to new tabs from _history.
    if (window.isInitialPage(aBrowser.currentURI)) {
      log.debug(
        "onStateChange: not including this state change in _history, because it's an about page: ",
        aBrowser.currentURI.spec
      );
      return;
    }
    if (aBrowser !== window.gBrowser.selectedBrowser) {
      log.debug(
        "onStateChange: not including this state change in _history, because it's not from the selected browser: ",
        aBrowser.currentURI.spec
      );
      return;
    }

    // Todo: we probably need to do something smarter if this already exists in history.
    // Maybe move it up to the top of the stack, or something?
    if (
      state._history
        .map(h => h.plainURI)
        .indexOf(window.gBrowser.currentURI.spec) > -1
    ) {
      log.debug(
        "onStateChange: already have URI in stack so skipping",
        window.gBrowser.currentURI.spec
      );
      return;
    }

    // We have a legit page visit, so add a new entry to _history.
    log.debug(
      "onStateChange: adding a history entry for ",
      aBrowser.currentURI.spec
    );

    state._history.push({
      tab: aBrowser.getTabBrowser().selectedTab,
      type: "navigate",
      uri: aBrowser.currentURI,
      plainURI: aBrowser.currentURI.spec,
    });
    log.debug("onStateChange: _history.length is ", state._history.length);
    // Because we're navigating to a new page, reset _historyDepth to 0.
    state._historyDepth = 0;
    CompanionGlobalHistory.dispatchEvent(
      new CustomEvent("CompanionGlobalHistoryChange")
    );
  },

  QueryInterface: ChromeUtils.generateQI([
    "nsIWebProgressListener",
    "nsIWebProgressListener2",
    "nsISupportsWeakReference",
  ]),
};

// Initial extremely naive implementation:
//
// We track page loads and tab switches in _history.
//
// When the user hits the Back button, if the most recent history entry was a
// tabswitch, then switch to the tab from the next earlier history entry.
// Also move the tab into the correct location in the history to get to the proper
// url.
// Todo: Handle removed tabs by opening the URL in a new tab?
const CompanionGlobalHistory = Object.assign(new EventTarget(), {
  init() {
    if (this.inited) {
      return;
    }
    this.inited = true;
  },

  addBrowserWindow(aWindow) {
    log.debug("addBrowserWindow");
    if (HISTORY_STATE.has(aWindow)) {
      log.error("addBrowserWindow called with existing window");
      return;
    }
    HISTORY_STATE.set(aWindow, {
      // This is a simplified per-window global list of all (URL, tab) pairs in the
      // history of the current session.
      //
      // History items are of the form { tab, type, uri, plainURI }, where:
      //   type is "navigate" for loading new pages and "tabswitch" for tab switching.
      //   tab is a Tab
      //   uri is a URI
      //   plainURI is the uri.spec so we can skim _history in the debugger
      _history: [],

      // This is how far back we are in the _history when we are going back and
      // forward.
      _historyDepth: 0,
    });

    aWindow.gBrowser.tabContainer.addEventListener("TabSelect", this);
    aWindow.gBrowser.addTabsProgressListener(progressListener);
  },

  removeBrowserWindow(aWindow) {
    if (!HISTORY_STATE.has(aWindow)) {
      log.error("removeBrowserWindow error: unknown window");
      return;
    }
    aWindow.gBrowser.tabContainer.removeEventListener("TabSelect", this);
    aWindow.gBrowser.removeTabsProgressListener(progressListener);
    HISTORY_STATE.delete(aWindow);
  },

  handleEvent(event) {
    if (event.type === "TabSelect") {
      let window = event.target.ownerGlobal;
      let state = HISTORY_STATE.get(window);

      if (!state) {
        log.error("handleEvent: error: unknown window");
        return;
      }

      // Todo: we probably need to do something smarter if this already exists in history.
      // Maybe move it up to the top of the stack, or something?

      let index = state._history
        .map(h => h.plainURI)
        .lastIndexOf(window.gBrowser.currentURI.spec);
      if (index > -1) {
        log.debug(
          "handleEvent: already have URI in stack so resetting depth",
          window.gBrowser.currentURI.spec,
          index
        );
        // If a tab already in the history gets focused then move the depth to the
        // right place and return
        state._historyDepth = state._history.length - 1 - index;
        CompanionGlobalHistory.dispatchEvent(
          new CustomEvent("CompanionGlobalHistoryChange")
        );
        return;
      }

      // Exclude about: pages related to new tabs from _history.
      if (window.isInitialPage(window.gBrowser.currentURI)) {
        log.debug(
          "onStateChange: not including this state change in _history, because it's an about page: ",
          window.gBrowser.currentURI.spec
        );
        return;
      }

      log.debug(
        "handleEvent: TabSelect fired. Adding a 'tabswitch' to history."
      );
      state._history.push({
        tab: event.target,
        uri: window.gBrowser.currentURI,
        type: "tabswitch",
        plainURI: window.gBrowser.currentURI.spec,
      });
      // TODO: this seems weird, but since switching tabs adds to history,
      // we need to reset our history depth. We can refine this as we go.
      state._historyDepth = 0;
      CompanionGlobalHistory.dispatchEvent(
        new CustomEvent("CompanionGlobalHistoryChange")
      );
    }
  },

  browserBack(aWindow) {
    if (!this.canGoBack(aWindow)) {
      return false;
    }

    let state = HISTORY_STATE.get(aWindow);
    let currentHistoryPosition =
      state._history.length - 1 - state._historyDepth;
    // let currentStep = state._history[currentHistoryPosition];
    let previousStep = state._history[currentHistoryPosition - 1];

    // Keep track of how deep we're traveling into history.
    state._historyDepth++;
    CompanionGlobalHistory.dispatchEvent(
      new CustomEvent("CompanionGlobalHistoryChange")
    );

    let sessionHistory = SessionStore.getSessionHistory(previousStep.tab);
    let index = sessionHistory.entries
      .map(e => e.url)
      .lastIndexOf(previousStep.plainURI);
    aWindow.gBrowser.selectedTab = previousStep.tab;

    if (index > -1) {
      aWindow.gBrowser.selectedBrowser.gotoIndex(index);
    }

    return true;
  },

  browserForward(aWindow) {
    if (!this.canGoForward(aWindow)) {
      return false;
    }

    let state = HISTORY_STATE.get(aWindow);
    let currentHistoryPosition =
      state._history.length - 1 - state._historyDepth;
    let nextStep = state._history[currentHistoryPosition + 1];

    // Keep track of how deep we're traveling into history.
    state._historyDepth--;
    CompanionGlobalHistory.dispatchEvent(
      new CustomEvent("CompanionGlobalHistoryChange")
    );

    let sessionHistory = SessionStore.getSessionHistory(nextStep.tab);
    let index = sessionHistory.entries
      .map(e => e.url)
      .lastIndexOf(nextStep.plainURI);

    aWindow.gBrowser.selectedTab = nextStep.tab;
    if (index > -1) {
      aWindow.gBrowser.selectedBrowser.gotoIndex(index);
    }
    return true;
  },

  // If _historyDepth isn't at the start of _history, we can go back.
  canGoBack(aWindow) {
    let state = HISTORY_STATE.get(aWindow);
    if (!state) {
      return false;
    }
    return state._history.length - 1 - state._historyDepth > 0;
  },

  // If _historyDepth > 0, we can go forward.
  canGoForward(aWindow) {
    let state = HISTORY_STATE.get(aWindow);
    if (!state) {
      return false;
    }
    return state._historyDepth > 0;
  },

  historyForWindow(aWindow) {
    return HISTORY_STATE.get(aWindow);
  },
});

CompanionGlobalHistory.init();
