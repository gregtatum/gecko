/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["GlobalHistory"];

/**
 * This component tracks the views that a user visits. Instances of GlobalHistory track the views
 * for a single top-level window
 */
const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

ChromeUtils.defineModuleGetter(
  this,
  "ActorManagerParent",
  "resource://gre/modules/ActorManagerParent.jsm"
);

ChromeUtils.defineModuleGetter(
  this,
  "SessionStore",
  "resource:///modules/sessionstore/SessionStore.jsm"
);
ChromeUtils.defineModuleGetter(
  this,
  "SessionHistory",
  "resource://gre/modules/sessionstore/SessionHistory.jsm"
);

const SESSIONSTORE_STATE_KEY = "GlobalHistoryState";

// Set to true if we register the TopLevelNavigationDelegate JSWindowActor.
// We record this at the module level so that subsequent browser window
// openings don't try to re-register the same actor (which will throw an
// exception).
let gTopLevelNavigationDelegateRegistered = false;

function requestedIndex(sessionHistory) {
  return sessionHistory.requestedIndex == -1
    ? sessionHistory.index
    : sessionHistory.requestedIndex;
}

function currentEntry(browser) {
  let { sessionHistory } = browser.browsingContext;
  let index = requestedIndex(sessionHistory);
  if (index < 0) {
    return null;
  }

  return sessionHistory.getEntryAtIndex(index);
}

function getBrowserHistoryForView(window, view) {
  let browser = BrowsingContext.get(view.browserId)?.embedderElement;
  if (!browser || !window.document.contains(browser)) {
    return {
      browser: null,
      historyIndex: null,
      historyEntry: null,
    };
  }

  let sHistory = browser.browsingContext.sessionHistory;

  for (let i = 0; i < sHistory.count; i++) {
    let historyEntry = sHistory.getEntryAtIndex(i);
    if (historyEntry.ID == view.historyId) {
      return {
        browser,
        historyIndex: i,
        historyEntry,
      };
    }
  }

  return {
    browser,
    historyIndex: null,
    historyEntry: null,
  };
}

/**
 * A single view in the global history. These are intended to be non-mutable.
 */
class View {
  #internalView;
  #userTitle;

  /**
   * @param {InternalView} internalView
   */
  constructor(internalView) {
    this.#internalView = internalView;
  }

  /** @type {string} */
  get url() {
    return this.#internalView.url;
  }

  /** @type {string} */
  /** Always return user edited title if present **/
  get title() {
    return this.#userTitle || this.#internalView.title;
  }

  set userTitle(userTitle) {
    this.#userTitle = userTitle;
  }

  get iconURL() {
    return this.#internalView.iconURL;
  }

  /**
   * Returns the appropriate connection state security flag for this view.
   *
   * nsIWebProgressListener.STATE_IS_INSECURE
   *   This flag indicates that the data corresponding to the request
   *   was received over an insecure channel.
   *
   * nsIWebProgressListener.STATE_IS_BROKEN
   *   This flag indicates an unknown security state.  This may mean that the
   *   request is being loaded as part of a page in which some content was
   *   received over an insecure channel.
   *
   * nsIWebProgressListener.STATE_IS_SECURE
   *   This flag indicates that the data corresponding to the request was
   *   received over a secure channel.
   *
   * @type {number}
   */
  get securityState() {
    return this.#internalView.securityState;
  }

  /**
   * Indicates the type of "about" error page we've shown in this view.
   * For e.g. certerror, neterror, about:blocked, etc
   * @type {string | null}
   */
  get errorPageType() {
    return this.#internalView.errorPageType;
  }

  get pinned() {
    return this.#internalView.pinned;
  }
}

class InternalView {
  /** @type {View} */
  #view;

  #window;

  /** @type {boolean} **/
  #pinned;

  /**
   * @param {DOMWindow} window
   * @param {Browser | null} browser
   * @param {nsISHEntry} historyEntry
   */
  constructor(window, browser, historyEntry) {
    this.#window = window;
    this.#view = new View(this);
    this.#pinned = false;
    InternalView.viewMap.set(this.#view, this);

    // cachedEntry is set when session history has purged or truncated
    // the nsISHEntry associated with this InternalView. InternalView
    // holds on to that entry so that it's possible for the user
    // to eventually return to this state despite it having been removed.
    this.cachedEntry = null;

    if (browser) {
      this.update(browser, historyEntry);
    } else {
      this.cachedEntry = historyEntry;
      this.historyId = historyEntry.ID;
      this.url = Services.io.newURI(historyEntry.url);
      this.title = historyEntry.title;
      this.iconURL = null;
    }
  }

  /**
   * Returns the type of "about" error page we've shown in this view. Note that
   * it only does so in case of "certerror", "neterror", "blocked" and "httpsonlyerror"
   * pages.
   */
  #getErrorPageType(docURI) {
    let errorPageTypes = ["neterror", "httpsonlyerror", "blocked"];
    if (
      docURI.filePath == "certerror" ||
      (docURI.filePath == "neterror" &&
        new URLSearchParams(docURI.query).get("e") == "nssFailure2")
    ) {
      return "certerror";
    } else if (errorPageTypes.includes(docURI.filePath)) {
      return docURI.filePath;
    }

    return null;
  }

  update(browser, historyEntry) {
    this.browserId = browser.browsingContext.id;
    this.historyId = historyEntry.ID;
    this.cachedEntry = null;

    this.url = historyEntry.URI;
    this.title = historyEntry.title;
    this.iconURL = browser.mIconURL;
    this.securityState = browser.securityUI.state;
    let docURI = browser?.documentURI;
    if (docURI && docURI.scheme == "about") {
      this.errorPageType = this.#getErrorPageType(docURI);
    }

    if (
      Services.prefs.getBoolPref(
        "browser.companion.globalhistorydebugging",
        false
      )
    ) {
      this.historyState = {
        pinned: this.#pinned,
        historyId: historyEntry.ID,
        originalURISpec: historyEntry.originalURI?.spec,
        loadReplace: historyEntry.loadReplace,
        hasUserInteraction: historyEntry.hasUserInteraction,
        hasUserActivation: historyEntry.hasUserActivation,
        URIWasModified: historyEntry.URIWasModified,
        persist: historyEntry.persist,
        securityState: browser.securityUI.state,
      };
    }
  }

  /** @type {boolean} */
  get pinned() {
    return this.#pinned;
  }

  set pinned(isPinned) {
    if (this.#pinned == isPinned) {
      return;
    }

    this.#pinned = isPinned;

    // If GlobalHistory debugging is enabled, then we want to also update
    // the historyState object that gets shown in the sidebar.
    if (
      Services.prefs.getBoolPref(
        "browser.companion.globalhistorydebugging",
        false
      )
    ) {
      let { browser, historyEntry } = getBrowserHistoryForView(
        this.#window,
        this
      );
      if (browser && historyEntry) {
        this.update(browser, historyEntry);
      }
    }
  }

  /** @type {View} */
  get view() {
    return this.#view;
  }

  get state() {
    let { browser, historyIndex } = getBrowserHistoryForView(
      this.#window,
      this
    );

    if (browser && historyIndex !== null) {
      if (
        requestedIndex(browser.browsingContext.sessionHistory) == historyIndex
      ) {
        return "open";
      }
      return "cached";
    }

    return "pruned";
  }

  /** @type {WeakMap<View, InternalView>} */
  static viewMap = new WeakMap();
}

/**
 * An event fired from GlobalHistory to inform about changes to the view stack. Can be one of the
 * following types:
 *
 * `ViewChanged` - The current view has changed.
 * `ViewAdded` - A new view has been added to the top of the stack.
 * `ViewRemoved` - A view has been removed from the bottom of the stack.
 * `ViewMoved` - An existing view has been moved to the top of the stack.
 * `ViewUpdated` - An existing view has been moved to the top of the stack.
 * `RiverRebuilt` - The river has been replaced with a new state and should be rebuilt.
 * `ViewPinned` - A view has transitioned from the unpinned to pinned state.
 * `ViewUnpinned` - A view has transitioned from the pinned to unpinned state.
 */
class GlobalHistoryEvent extends Event {
  #view;

  /**
   * @param {"ViewChanged" | "ViewAdded" | "ViewMoved" | "ViewRemoved" | "ViewUpdated" | "RiverRebuilt"} type
   *   The event type.
   * @param {View | null}
   *   The related view.
   */
  constructor(type, view) {
    super(type);
    this.#view = view;
    if (view && !(view instanceof View)) {
      console.error("Emitting a global history event with a non-view", view);
    }
  }

  /**
   * The view that this event refers to.
   * @type {View}
   */
  get view() {
    return this.#view;
  }
}

/**
 * This listens for changes to a browsers history. The nsISHistoryListener methods are called
 * *before* the nsISHistory list is updated so we await on a resolved promise to allow those changes
 * to happen before we do anything.
 */
class BrowserListener {
  /** @type {GlobalHistory} */
  #globalHistory;
  /** @type {Browser} */
  #browser;

  /**
   * @param {GlobalHistory} globalHistory
   * @param {Browser} browser
   */
  constructor(globalHistory, browser) {
    this.#globalHistory = globalHistory;
    this.#browser = browser;

    this.#browser.addEventListener("pagetitlechanged", this);
  }

  handleEvent() {
    // Title changed.
    this.#globalHistory._onNewTitle(this.#browser);
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryNewEntry(newURI, oldIndex) {
    await Promise.resolve();

    this.#globalHistory._onBrowserNavigate(this.#browser);
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryReload() {
    await Promise.resolve();
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryGotoIndex() {
    await Promise.resolve();

    this.#globalHistory._onBrowserNavigate(this.#browser);
  }

  /**
   * See nsISHistoryListener
   */
  OnHistoryPurge(numEntries) {
    // History entries are going to be purged, grab them and their tab state and stash them as
    // as closed tab.
    let { entries } = JSON.parse(
      SessionStore.getTabState(
        this.#browser.getTabBrowser().getTabForBrowser(this.#browser)
      )
    );

    this.#globalHistory._onHistoryEntriesRemoved(entries.slice(0, numEntries));
  }

  /**
   * See nsISHistoryListener
   */
  OnHistoryTruncate(numEntries) {
    // History entries are going to be truncated, grab them and their tab state and stash them as
    // as closed tab.
    let { entries } = JSON.parse(
      SessionStore.getTabState(
        this.#browser.getTabBrowser().getTabForBrowser(this.#browser)
      )
    );

    this.#globalHistory._onHistoryEntriesRemoved(
      entries.slice(entries.length - numEntries)
    );
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryReplaceEntry() {
    let { sessionHistory } = this.#browser.browsingContext;
    let previousEntry = sessionHistory.getEntryAtIndex(
      requestedIndex(sessionHistory)
    );

    await Promise.resolve();

    let newEntry = currentEntry(this.#browser);

    this.#globalHistory._onBrowserReplace(
      this.#browser,
      previousEntry,
      newEntry
    );
  }

  QueryInterface = ChromeUtils.generateQI([
    "nsISHistoryListener",
    "nsISupportsWeakReference",
  ]);
}

/**
 * A "Most Recently Used" stack of history entries scoped to a top-level window. Each time the user
 * browses to a new view that view is put on the top of the stack.
 *
 * Can emit the following events:
 *
 * `ViewChanged` - The current view has changed. The new view will be included in the event detail.
 * `ViewAdded` - A new view has been added to the top of the stack.
 * `ViewMoved` - An existing view has been moved to the top of the stack.
 * `ViewRemoved` - An existing view has been removed.
 * `ViewUpdated` - An existing view has changed in some way.
 * `ViewPinned` - A view has transitioned from the unpinned to pinned state.
 * `ViewUnpinned` - A view has transitioned from the pinned to unpinned state.
 *    The view will be included in the event detail
 */
class GlobalHistory extends EventTarget {
  /**
   * The window this instance is tracking the history for.
   * @type {DOMWindow}
   */
  #window;

  /**
   * The stack of views. Most recent is at the end of the list.
   * @type {InternalView[]}
   */
  #viewStack = [];

  /**
   * Maintains a reference to the browser listener as long as the browser is alive.
   * @type {WeakMap<Browser, BrowserListener>}
   */
  #browsers = new WeakMap();

  /**
   * A map from session history identifiers to views.
   * @type {Map<number, InternalView>}
   */
  #historyViews = new Map();

  /**
   * The position of the current view in the stack.
   * @type {number | null}
   */
  #currentIndex = null;

  /**
   * A timer to track when to activate the current view.
   */
  #activationTimer = null;

  /**
   * A view that is being reloaded.
   * @type {InternalView}
   */
  #pendingView = null;

  /**
   * True if the window is currently being restored from a saved session.
   */
  #windowRestoring = false;

  /**
   * @param {DOMWindow} window
   *   The top level window to track history for.
   */
  constructor(window) {
    super();
    this.#window = window;

    if (!Services.appinfo.sessionHistoryInParent) {
      throw new Error(
        "Cannot function unless session history is in the parent."
      );
    }

    const GlobalHistoryActors = {
      TopLevelNavigationDelegate: {
        parent: {
          moduleURI: "resource:///actors/TopLevelNavigationDelegateParent.jsm",
        },
        child: {
          moduleURI: "resource:///actors/TopLevelNavigationDelegateChild.jsm",
        },

        messageManagerGroups: ["browsers"],
      },
    };

    if (
      Services.prefs.getBoolPref(
        "browser.tabs.openNewTabForMostNavigations",
        false
      ) &&
      !gTopLevelNavigationDelegateRegistered
    ) {
      ActorManagerParent.addJSWindowActors(GlobalHistoryActors);
      gTopLevelNavigationDelegateRegistered = true;
    }

    for (let { linkedBrowser: browser } of this.#window.gBrowser.tabs) {
      this.#watchBrowser(browser);
    }

    this.#window.gBrowser.tabContainer.addEventListener("TabSelect", event =>
      this.#tabSelected(event.target)
    );

    this.#window.gBrowser.tabContainer.addEventListener("TabOpen", event =>
      this.#tabOpened(event.target)
    );

    this.#window.gBrowser.tabContainer.addEventListener(
      "TabAttrModified",
      event => this.#tabAttrModified(event.target, event.detail.changed)
    );

    this.#window.addEventListener("SSWindowStateBusy", () =>
      this.#sessionRestoreStarted()
    );

    this.#window.gBrowser.addTabsProgressListener(this);
  }

  onSecurityChange(browser, webProgress, request, status) {
    let entry = currentEntry(browser);
    if (!entry) {
      return;
    }

    let internalView = this.#historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.update(browser, entry);
    this.dispatchEvent(
      new GlobalHistoryEvent("ViewUpdated", internalView.view)
    );
  }

  /**
   * Dispatches a GlobalHistoryEvent of type "type" on this.
   *
   * @param {String} type The type of GlobalHistoryEvent to dispatch.
   * @param {InternalView} internalView The InternalView associated with the
   *   event. Note that the associated View will be attached to the event, and
   *   not the InternalView.
   */
  #notifyEvent(type, internalView) {
    this.dispatchEvent(new GlobalHistoryEvent(type, internalView?.view));
  }

  #sessionRestoreStarted() {
    // Window is starting restoration, stop listening to everything.
    this.#windowRestoring = true;

    if (this.#activationTimer) {
      this.#window.clearTimeout(this.#activationTimer);
    }

    for (let { linkedBrowser: browser } of this.#window.gBrowser.tabs) {
      let listener = this.#browsers.get(browser);
      if (listener) {
        try {
          browser.browsingContext.sessionHistory.removeSHistoryListener(
            listener
          );
        } catch (e) {
          console.error("Failed to remove listener", e);
        }
      }
    }

    this.#browsers = new WeakMap();

    this.#window.addEventListener(
      "SSWindowStateReady",
      () => {
        this.#sessionRestoreEnded();
      },
      { once: true }
    );
  }

  #tabRestored(tab) {
    let { sessionHistory } = tab.linkedBrowser.browsingContext;
    for (let i = 0; i < sessionHistory.count; i++) {
      let entry = sessionHistory.getEntryAtIndex(i);
      let internalView = this.#historyViews.get(entry.ID);
      if (!internalView) {
        let previousID = SessionHistory.getPreviousID(entry);
        if (previousID) {
          internalView = this.#historyViews.get(previousID);
          if (internalView) {
            this.#historyViews.set(entry.ID, internalView);
          }
        }
      }

      if (internalView) {
        internalView.update(tab.linkedBrowser, entry);
      }
    }

    this.#watchBrowser(tab.linkedBrowser);
  }

  #sessionRestoreEnded() {
    // Session restore is done, rebuild everything from the new state.
    this.#windowRestoring = false;

    let stateStr = SessionStore.getCustomWindowValue(
      this.#window,
      SESSIONSTORE_STATE_KEY
    );

    this.#viewStack = [];
    this.#historyViews.clear();

    // Tabs are not yet functional so build a set of views from cached history state.
    let state = (stateStr && JSON.parse(stateStr)) || [];
    if (!state.length) {
      console.error("No state to rebuild from.");
    }

    let missingIds = new Set();
    for (let { id, cachedEntry } of state) {
      if (cachedEntry) {
        let internalView = new InternalView(this.#window, null, cachedEntry);
        this.#historyViews.set(id, internalView);
      } else {
        missingIds.add(id);
      }
    }

    let [windowState] = JSON.parse(
      SessionStore.getWindowState(this.#window)
    ).windows;

    for (let tab of windowState.tabs) {
      for (let cachedEntry of tab.entries) {
        if (missingIds.has(cachedEntry.ID)) {
          let internalView = new InternalView(this.#window, null, cachedEntry);
          this.#historyViews.set(cachedEntry.ID, internalView);
        }
      }
    }

    // Push those views onto the stack and to the river.
    for (let { id } of state) {
      let internalView = this.#historyViews.get(id);
      if (!internalView) {
        console.warn("Missing history entry for river entry.");
        continue;
      }

      this.#viewStack.push(internalView);
    }

    let selectedTab = windowState.tabs[windowState.selected - 1];
    let selectedEntry = selectedTab.entries[selectedTab.index - 1];
    let selectedView = this.#historyViews.get(selectedEntry.ID);

    if (!selectedView) {
      console.warn("Selected entry was not in state.");
      selectedView = new InternalView(this.#window, null, selectedEntry);
      this.#historyViews.set(selectedEntry.ID, selectedView);

      this.#viewStack.push(selectedView);
    }

    // Mark the correct view.
    this.#currentIndex = this.#viewStack.indexOf(selectedView);
    this.#notifyEvent("RiverRebuilt", selectedView);

    // Wait for tabs to finish restoring.
    for (let tab of this.#window.gBrowser.tabs) {
      tab.addEventListener("SSTabRestoring", () => this.#tabRestored(tab), {
        once: true,
      });
    }

    this.#startActivationTimer();
  }

  #updateSessionStore() {
    // Stash the view order into session store.
    let state = this.#viewStack.map(internalView => ({
      id: internalView.historyId,
      cachedEntry: internalView.cachedEntry,
    }));

    SessionStore.setCustomWindowValue(
      this.#window,
      SESSIONSTORE_STATE_KEY,
      JSON.stringify(state)
    );
  }

  /**
   * @param {Browser} browser
   */
  #watchBrowser(browser) {
    if (this.#browsers.has(browser)) {
      return;
    }

    let listener = new BrowserListener(this, browser);
    this.#browsers.set(browser, listener);

    try {
      browser.browsingContext.sessionHistory.addSHistoryListener(listener);
    } catch (e) {
      console.error("Failed to add listener", e);
    }
  }

  /**
   * @param {Tab} newTab
   */
  #tabSelected(newTab) {
    if (this.#windowRestoring) {
      return;
    }

    this._onBrowserNavigate(newTab.linkedBrowser);
  }

  /**
   * @param {Tab} newTab
   */
  #tabOpened(newTab) {
    if (this.#windowRestoring) {
      return;
    }

    let browser = newTab.linkedBrowser;
    this.#watchBrowser(browser);
    this._onBrowserNavigate(browser);
  }

  /**
   * @param {Tab} tab
   * @param {Array} changed
   */
  #tabAttrModified(tab, changed) {
    if (this.#windowRestoring) {
      return;
    }

    if (changed.includes("image")) {
      let browser = tab.linkedBrowser;
      this._onNewIcon(browser);
    }
  }

  /**
   * Called when some nsISHEntry's have been removed from a browser
   * being listened to.
   *
   * @param {nsISHEntry[]} entries The entries that were removed.
   */
  _onHistoryEntriesRemoved(entries) {
    for (let entry of entries) {
      let internalView = this.#historyViews.get(entry.ID);
      if (internalView) {
        internalView.cachedEntry = entry;
      }
    }

    this.#updateSessionStore();
  }

  /**
   * Called when the document in a browser has changed title.
   */
  _onNewTitle(browser) {
    let entry = currentEntry(browser);
    let internalView = this.#historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.title = entry.title;
    this.#notifyEvent("ViewUpdated", internalView);
  }

  /**
   * Called when the document in a browser has changed its favicon.
   */
  _onNewIcon(browser) {
    let entry = currentEntry(browser);
    let internalView = this.#historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.iconURL = browser.mIconURL;
    this.#notifyEvent("ViewUpdated", internalView);
  }

  /**
   * Called when a browser loads a view.
   *
   * @param {Browser} browser
   * @param {nsISHEntry} newEntry
   */
  _onBrowserNavigate(browser, newEntry = currentEntry(browser)) {
    if (!newEntry) {
      // Happens before anything has been loaded into the browser.
      return;
    }

    if (this.#window.gBrowser.selectedBrowser !== browser) {
      // Only care about the currently visible browser. We will re-visit if the tab is selected.
      return;
    }

    if (this.#window.isInitialPage(newEntry.URI)) {
      // Don't store initial pages in the river.
      this.#currentIndex = null;
      return;
    }

    let internalView = this.#historyViews.get(newEntry.ID);
    if (!internalView) {
      // It's possible that a session restoration has resulted in a new
      // nsISHEntry being created with a new ID that doesn't match the one
      // we're looking for. Thankfully, SessionHistory keeps track of this,
      // so we can try to map the new nsISHEntry's ID to the previous ID,
      // and then update our references to use the new ID.
      let previousID = SessionHistory.getPreviousID(newEntry);
      if (previousID) {
        internalView = this.#historyViews.get(previousID);
        if (internalView) {
          this.#historyViews.set(newEntry.ID, internalView);
        }
      }
    }

    if (!internalView && this.#pendingView?.url.spec == newEntry.URI.spec) {
      internalView = this.#pendingView;
      this.#historyViews.delete(internalView.historyId);
      this.#historyViews.set(internalView.historyId, internalView);
      this.#pendingView = null;
    }

    if (!internalView) {
      // This is a new view.
      internalView = new InternalView(this.#window, browser, newEntry);
      this.#currentIndex = this.#viewStack.length;
      this.#viewStack.push(internalView);
      this.#historyViews.set(newEntry.ID, internalView);

      this.#notifyEvent("ViewAdded", internalView);
    } else {
      // This is a navigation to an existing view.
      internalView.update(browser, newEntry);

      let pos = this.#viewStack.indexOf(internalView);
      if (pos == this.#currentIndex) {
        // Nothing to do.
        return;
      }

      if (pos < 0) {
        console.warn("Navigated to a view not in the existing stack.");
        this.#currentIndex = this.#viewStack.length;
        this.#viewStack.push(internalView);

        this.#notifyEvent("ViewAdded", internalView);
      } else {
        this.#currentIndex = pos;
      }
    }

    this.#notifyEvent("ViewChanged", internalView);

    this.#startActivationTimer();
    this.#updateSessionStore();
  }

  #startActivationTimer() {
    if (this.#activationTimer) {
      this.#window.clearTimeout(this.#activationTimer);
    }

    let timeout = GlobalHistory.activationTimeout;
    if (timeout == 0) {
      return;
    }

    this.#activationTimer = this.#window.setTimeout(() => {
      this.#activateCurrentView();
    }, timeout);
  }

  #activateCurrentView() {
    this.#activationTimer = null;
    if (
      this.#currentIndex === null ||
      this.#currentIndex == this.#viewStack.length - 1
    ) {
      return;
    }

    if (this.currentView.pinned) {
      return;
    }

    let [internalView] = this.#viewStack.splice(this.#currentIndex, 1);
    this.#viewStack.push(internalView);
    this.#currentIndex = this.#viewStack.length - 1;
    this.#notifyEvent("ViewMoved", internalView);
    this.#updateSessionStore();
  }

  /**
   * Called when a new history entry replaces an older one.
   *
   * @param {Browser} browser
   * @param {nsISHEntry} previousEntry
   * @param {nsISHEntry} newEntry
   */
  _onBrowserReplace(browser, previousEntry, newEntry) {
    let previousView = this.#historyViews.get(previousEntry.ID);
    if (previousView) {
      this.#historyViews.delete(previousEntry.ID);

      let pos = this.#viewStack.indexOf(previousView);
      if (pos >= 0) {
        if (this.#window.isInitialPage(newEntry.URI)) {
          // Don't store initial pages in the river.
          this.#viewStack.splice(pos, 1);

          if (pos == this.#currentIndex) {
            this.#currentIndex = null;
          } else if (this.#currentIndex > pos) {
            this.#currentIndex--;
          }

          this.#notifyEvent("ViewRemoved", previousView);

          if (this.#currentIndex === null) {
            this.#notifyEvent("ViewChanged", null);
          }

          return;
        }

        previousView.update(browser, newEntry);
        this.#historyViews.set(newEntry.ID, previousView);

        this.#notifyEvent("ViewUpdated", previousView);
        this.#updateSessionStore();
        return;
      }
    }

    // Fallback in the event that the previous entry is not present in the stack.
    this._onBrowserNavigate(browser, newEntry);
  }

  /**
   * Returns a snapshot of the current stack of views.
   * @type {View[]}
   */
  get views() {
    return this.#viewStack.map(internalView => internalView.view);
  }

  /**
   * Returns a snapshot of the current stack of InternalViews. This is
   * an encapsulation violation and only returns a non-null value when
   * running with browser.companion.globalhistorydebugging set to `true`.
   *
   * Do not use this for production code.
   *
   * @type {InternalView[]}
   */
  get internalViewsDebuggingOnly() {
    if (
      !Services.prefs.getBoolPref(
        "browser.companion.globalhistorydebugging",
        false
      )
    ) {
      return null;
    }

    return [...this.#viewStack];
  }

  /**
   * Returns the currently displayed view on null if there is no current view.
   * @type {View | null}
   */
  get currentView() {
    if (this.#currentIndex === null) {
      return null;
    }

    return this.#viewStack[this.#currentIndex].view;
  }

  /**
   * Navigates to the given view.
   *
   * @param {View} view
   *   The view to navigate to.
   */
  async setView(view) {
    let internalView = InternalView.viewMap.get(view);
    if (!internalView) {
      throw new Error("Unknown view.");
    }

    let pos = this.#viewStack.indexOf(internalView);
    if (pos == -1) {
      throw new Error("Unknown View.");
    }

    if (this.#currentIndex == pos) {
      // Nothing to do.
      return;
    }

    let { browser, historyIndex } = getBrowserHistoryForView(
      this.#window,
      internalView
    );

    if (historyIndex !== null) {
      let sHistory = browser.browsingContext.sessionHistory;

      // Navigate if necessary.
      let currentIndex = requestedIndex(sHistory);
      if (currentIndex != historyIndex) {
        browser.gotoIndex(historyIndex);
      }

      // Tab switch if necessary.
      if (this.#window.gBrowser.selectedBrowser !== browser) {
        let tab = this.#window.gBrowser.getTabForBrowser(browser);
        this.#window.gBrowser.selectedTab = tab;
      }

      // The history navigation/tab switch should be detected and send out the ViewChanged
      // notification.
      return;
    }

    let { cachedEntry } = internalView;
    if (cachedEntry) {
      let tab = this.#window.gBrowser.addTrustedTab("about:blank", {
        skipAnimation: true,
      });

      SessionStore.setTabState(tab, { entries: [cachedEntry] });

      this.#window.gBrowser.selectedTab = tab;
      return;
    }

    // Either the browser is gone or the history entry is gone and for some reason we have no cache
    // of the session.
    console.warn("Recreating a view with no cached entry.");
    this.#pendingView = internalView;
    this.#window.gBrowser.selectedTab = this.#window.gBrowser.addWebTab(
      internalView.url.spec
    );
  }

  /**
   * Sets the `pinned` state on a View to shouldPin.
   *
   * @param {View} view The View to set the pinned state on.
   * @param {boolean} shouldPin True if the View should be pinned.
   */
  setViewPinnedState(view, shouldPin) {
    if (!Services.prefs.getBoolPref("browser.river.pinning.enabled", false)) {
      return;
    }

    if (view.pinned == shouldPin) {
      return;
    }

    let internalView = InternalView.viewMap.get(view);
    if (!internalView) {
      throw new Error("Unknown view.");
    }

    // We don't want to remove Pinned Views from the #viewStack Array,
    // since so much of GlobalHistory relies on all available Views
    // existing in it, and for the #currentIndex to point at the index
    // of the currently visible View.
    //
    // To accommodate Pinned Views, we borrow the organizational model
    // of Pinned Tabs from tabbrowser: Views that are pinned are moved
    // to the beginning of the #viewStack Array. So if we started with
    // this #viewStack:
    //
    // [Unpinned View 1, Unpinned View 2, Unpinned View 3]
    //
    // and then pinned View 3, #viewStack would become:
    //
    // [Pinned View 3, Unpinned View 1, Unpinned View 2]
    //
    // This way, we can keep pinned Views within #viewStack and not have
    // to treat them specially throughout GlobalHistory.

    let currentView = this.#viewStack[this.#currentIndex];
    let viewIndex = this.#viewStack.indexOf(internalView);

    this.#viewStack.splice(viewIndex, 1);
    let eventName;

    if (shouldPin) {
      this.#viewStack.splice(this.pinnedViewCount, 0, internalView);
      eventName = "ViewPinned";
    } else {
      this.#viewStack.push(internalView);
      eventName = "ViewUnpinned";
    }

    internalView.pinned = shouldPin;

    // Now that #viewStack has updated, make sure that #currentIndex correctly
    // points at currentView.
    this.#currentIndex = this.#viewStack.indexOf(currentView);
    this.#notifyEvent(eventName, internalView);
  }

  /**
   * @type {number} The number of pinned Views in this window.
   */
  get pinnedViewCount() {
    let firstUnpinned = this.#viewStack.findIndex(view => !view.pinned);
    return firstUnpinned == -1 ? 0 : firstUnpinned;
  }

  /**
   * Whether it is possible to navigate back in the global history.
   * @type {boolean}
   */
  get canGoBack() {
    return (
      this.#currentIndex > 0 && !this.#viewStack[this.#currentIndex - 1].pinned
    );
  }

  /**
   * Whether it is possible to navigate forwards in the global history.
   * @type {boolean}
   */
  get canGoForward() {
    return this.#currentIndex < this.#viewStack.length - 1;
  }

  /**
   * Navigates back in the global history. Returns true if navigation began.
   * @returns {boolean}
   */
  goBack() {
    if (!this.canGoBack) {
      return false;
    }

    this.setView(this.#viewStack[this.#currentIndex - 1].view);
    return true;
  }

  /**
   * Navigates forward in the global history. Returns true if navigation began.
   * @returns {boolean}
   */
  goForward() {
    if (!this.canGoForward) {
      return false;
    }

    this.setView(this.#viewStack[this.#currentIndex + 1].view);
    return true;
  }
}

XPCOMUtils.defineLazyPreferenceGetter(
  GlobalHistory,
  "activationTimeout",
  "browser.river.activationTimeout",
  5000
);
