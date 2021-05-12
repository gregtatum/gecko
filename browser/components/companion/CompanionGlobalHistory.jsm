/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["CompanionGlobalHistory"];

// This is a simplified per-window global list of all (URL, tab) pairs in the
// history of the current session.
//
// History items are of the form { tab, type, uri, plainURI }, where:
//   type is "navigate" for loading new pages and "tabswitch" for tab switching.
//   tab is a Tab
//   uri is a URI
//   plainURI is the uri.spec so we can skim _history in the debugger
let _history = [];

// This is how far back we are in the _history when we are going back and
// forward.
let _historyDepth = 0;

// If we are switching tabs in response to a back/forward button press, set
// this boolean so that our TabSwitch listener won't add it to history.
let _ignoreTabSwitch = false;

const excludedPages = ["about:newtab", "about:sessionrestore", "about:home"];

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
    if (excludedPages.includes(aBrowser.currentURI.spec)) {
      console.debug(
        "CompanionGlobalHistory.onStateChange: not including this state change in _history, because it's an about page: ",
        aBrowser.currentURI.spec
      );
      return;
    }

    // We have a legit page visit, so add a new entry to _history.
    console.debug(
      "CompanionGlobalHistory.onStateChange: adding a history entry for ",
      aBrowser.currentURI.spec
    );
    _history.push({
      tab: aBrowser.getTabBrowser().selectedTab,
      type: "navigate",
      uri: aBrowser.currentURI,
      plainURI: aBrowser.currentURI.spec,
    });
    // Because we're navigating to a new page, reset _historyDepth to 0.
    _historyDepth = 0;
    console.debug(
      "CompanionGlobalHistory.onStateChange: _history.length is ",
      _history.length
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
// Otherwise, let the existing BrowserBack / BrowserForward code manage moving
// through a single tab's history.
const CompanionGlobalHistory = {
  init() {
    console.debug("CompanionGlobalHistory.init");
    if (this.inited) {
      return;
    }
    this.inited = true;
  },

  addBrowserWindow(window) {
    console.debug("CompanionGlobalHistory.addBrowserWindow");
    try {
      // TODO for now assume one window. if a second window is loaded, clear
      // history and clear event listeners from old window.
      if (this._window) {
        this._window.gBrowser.tabContainer.removeEventListener(
          "TabSelect",
          this
        );
        this._window.gBrowser.removeTabsProgressListener(progressListener);
        _history = [];
        _historyDepth = 0;
      }
      this._window = window;

      this._window.gBrowser.tabContainer.addEventListener("TabSelect", this);
      this._window.gBrowser.addTabsProgressListener(progressListener);
      // TODO also listen for the window to be closed
    } catch (x) {
      console.error("CompanionGlobalHistory.addBrowserWindow error: ", x);
    }
  },

  handleEvent(event) {
    console.debug("CompanionGlobalHistory.handleEvent");
    if (event.type === "TabSelect") {
      // If the user is switching tabs via the back button, ignore it and
      // unset the flag.
      if (_ignoreTabSwitch) {
        console.debug(
          "CompanionGlobalHistory.handleEvent: TabSelect fired for a back or forward button tabswitch. Not adding to history."
        );
        _ignoreTabSwitch = false;
        return;
      }

      console.debug(
        "CompanionGlobalHistory.handleEvent: TabSelect fired. Adding a 'tabswitch' to history."
      );
      _history.push({
        tab: event.target,
        uri: this._window.gBrowser.currentURI,
        type: "tabswitch",
        plainURI: this._window.gBrowser.currentURI.spec,
      });
      // TODO: this seems weird, but since switching tabs adds to history,
      // we need to reset our history depth. We can refine this as we go.
      _historyDepth = 0;
    }
  },

  browserBack() {
    if (!this.canGoBack()) {
      return false;
    }

    let currentHistoryPosition = _history.length - 1 - _historyDepth;
    let currentStep = _history[currentHistoryPosition];
    let previousStep = _history[currentHistoryPosition - 1];

    // Keep track of how deep we're traveling into history.
    _historyDepth++;

    // If the most recent event was a tabswitch, then override the back button
    // to switch to the previous tab.
    if (currentStep.type == "tabswitch") {
      console.debug(
        "CompanionGlobalHistory.browserBack: tab switch detected in history. Switching tabs."
      );
      _ignoreTabSwitch = true;
      this._window.gBrowser.selectedTab = previousStep.tab;
      return true;
    }
    console.debug(
      "CompanionGlobalHistory.browserBack: tab switch not detected in history. Not switching tabs."
    );
    return false;
  },

  browserForward() {
    if (!this.canGoForward()) {
      return false;
    }

    let currentHistoryPosition = _history.length - 1 - _historyDepth;
    let nextStep = _history[currentHistoryPosition + 1];

    // Keep track of how deep we're traveling into history.
    _historyDepth--;

    // If the next step is a tabswitch, then override the forward button to
    // switch to that tab.
    if (nextStep.type == "tabswitch") {
      console.debug(
        "CompanionGlobalHistory.browserForward: tab switch detected in history. Switching tabs."
      );
      _ignoreTabSwitch = true;
      this._window.gBrowser.selectedTab = nextStep.tab;
      return true;
    }
    console.debug(
      "CompanionGlobalHistory.browserForward: tab switch not detected in history. Not switching tabs."
    );
    return false;
  },

  // If _historyDepth isn't at the start of _history, we can go back.
  canGoBack() {
    return _history.length - 1 - _historyDepth > 0;
  },

  // If _historyDepth > 0, we can go forward.
  canGoForward() {
    return _historyDepth > 0;
  },
};

CompanionGlobalHistory.init();
