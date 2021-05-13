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

const HISTORY_STATE = new WeakMap();

const progressListener = {
  onStateChange(aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {
    console.debug(
      "CompanionGlobalHistory.onStateChange: aStateFlags & STATE_RESTORING is ",
      aStateFlags & Ci.nsIWebProgressListener.STATE_RESTORING
    );
    console.debug(
      "CompanionGlobalHistory.onStateChange: aStateFlags & STATE_IS_NETWORK is ",
      aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK
    );

    let window = aBrowser.ownerGlobal;
    if (!HISTORY_STATE.has(window)) {
      console.error("CompanionGlobalHistory.onStateChange: unknown window");
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
      console.debug(
        "CompanionGlobalHistory.onStateChange: STATE_RESTORING detected, not adding this visit to history."
      );
      return;
    }

    // Exclude about: pages related to new tabs from _history.
    if (window.isInitialPage(aBrowser.currentURI)) {
      console.debug(
        "CompanionGlobalHistory.onStateChange: not including this state change in _history, because it's an about page: ",
        aBrowser.currentURI.spec
      );
      return;
    }
    if (aBrowser !== window.gBrowser.selectedBrowser) {
      console.debug(
        "CompanionGlobalHistory.onStateChange: not including this state change in _history, because it's not from the selected browser: ",
        aBrowser.currentURI.spec
      );
      return;
    }

    let _history = HISTORY_STATE.get(window)._history;

    // Todo: we probably need to do something smarter if this already exists in history.
    // Maybe move it up to the top of the stack, or something?
    if (
      _history.map(h => h.plainURI).indexOf(window.gBrowser.currentURI.spec) >
      -1
    ) {
      console.debug(
        "CompanionGlobalHistory.onStateChange: already have URI in stack so skipping",
        window.gBrowser.currentURI.spec
      );
      return;
    }

    // We have a legit page visit, so add a new entry to _history.
    console.debug(
      "CompanionGlobalHistory.onStateChange: adding a history entry for ",
      aBrowser.currentURI.spec
    );

    HISTORY_STATE.get(window)._history.push({
      tab: aBrowser.getTabBrowser().selectedTab,
      type: "navigate",
      uri: aBrowser.currentURI,
      plainURI: aBrowser.currentURI.spec,
    });
    console.debug(
      "CompanionGlobalHistory.onStateChange: _history.length is ",
      HISTORY_STATE.get(window)._history.length
    );
    // Because we're navigating to a new page, reset _historyDepth to 0.
    HISTORY_STATE.get(window)._historyDepth = 0;
    CompanionGlobalHistory.dispatchEvent(
      new CustomEvent("CompanionGlobalHistoryChange")
    );
    window.UpdateBackForwardCommands();
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
    console.debug("CompanionGlobalHistory.init");
    if (this.inited) {
      return;
    }
    this.inited = true;
  },

  addBrowserWindow(aWindow) {
    console.debug("CompanionGlobalHistory.addBrowserWindow");
    if (HISTORY_STATE.has(aWindow)) {
      console.error(
        "CompanionGlobalHistory.addBrowserWindow called with existing window"
      );
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
      console.error(
        "CompanionGlobalHistory.removeBrowserWindow error: unknown window"
      );
      return;
    }
    aWindow.gBrowser.tabContainer.removeEventListener("TabSelect", this);
    aWindow.gBrowser.removeTabsProgressListener(progressListener);
    HISTORY_STATE.delete(aWindow);
  },

  handleEvent(event) {
    if (event.type === "TabSelect") {
      let window = event.target.ownerGlobal;

      if (!HISTORY_STATE.has(window)) {
        console.error(
          "CompanionGlobalHistory.handleEvent: error: unknown window"
        );
        return;
      }

      let _history = HISTORY_STATE.get(window)._history;

      // Todo: we probably need to do something smarter if this already exists in history.
      // Maybe move it up to the top of the stack, or something?
      if (
        _history.map(h => h.plainURI).indexOf(window.gBrowser.currentURI.spec) >
        -1
      ) {
        console.debug(
          "CompanionGlobalHistory.handleEvent: already have URI in stack so skipping",
          window.gBrowser.currentURI.spec
        );
        return;
      }

      // Exclude about: pages related to new tabs from _history.
      if (window.isInitialPage(window.gBrowser.currentURI)) {
        console.debug(
          "CompanionGlobalHistory.onStateChange: not including this state change in _history, because it's an about page: ",
          window.gBrowser.currentURI.spec
        );
        return;
      }

      console.debug(
        "CompanionGlobalHistory.handleEvent: TabSelect fired. Adding a 'tabswitch' to history."
      );
      HISTORY_STATE.get(window)._history.push({
        tab: event.target,
        uri: window.gBrowser.currentURI,
        type: "tabswitch",
        plainURI: window.gBrowser.currentURI.spec,
      });
      // TODO: this seems weird, but since switching tabs adds to history,
      // we need to reset our history depth. We can refine this as we go.
      HISTORY_STATE.get(window)._historyDepth = 0;
      CompanionGlobalHistory.dispatchEvent(
        new CustomEvent("CompanionGlobalHistoryChange")
      );
      window.UpdateBackForwardCommands();
    }
  },

  browserBack(aWindow) {
    if (!this.canGoBack(aWindow)) {
      return false;
    }

    let { _history, _historyDepth } = HISTORY_STATE.get(aWindow);

    let currentHistoryPosition = _history.length - 1 - _historyDepth;
    // let currentStep = _history[currentHistoryPosition];
    let previousStep = _history[currentHistoryPosition - 1];

    // Keep track of how deep we're traveling into history.
    HISTORY_STATE.get(aWindow)._historyDepth++;
    CompanionGlobalHistory.dispatchEvent(
      new CustomEvent("CompanionGlobalHistoryChange")
    );

    let sessionHistory = SessionStore.getSessionHistory(previousStep.tab);
    let index = sessionHistory.entries
      .map(e => e.url)
      .lastIndexOf(previousStep.plainURI);
    aWindow.gBrowser.selectedTab = previousStep.tab;

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

    let { _history, _historyDepth } = HISTORY_STATE.get(aWindow);
    let currentHistoryPosition = _history.length - 1 - _historyDepth;
    let nextStep = _history[currentHistoryPosition + 1];

    // Keep track of how deep we're traveling into history.
    HISTORY_STATE.get(aWindow)._historyDepth--;
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
