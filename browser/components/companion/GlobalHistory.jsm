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
    };
  }

  let sHistory = browser.browsingContext.sessionHistory;

  for (let i = 0; i < sHistory.count; i++) {
    let historyEntry = sHistory.getEntryAtIndex(i);
    if (historyEntry.ID == view.historyId) {
      return {
        browser,
        historyIndex: i,
      };
    }
  }

  return {
    browser,
    historyIndex: null,
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
}

class InternalView {
  /** @type {View} */
  #view;

  #window;

  /**
   * @param {DOMWindow} window
   * @param {Browser} browser
   * @param {nsISHEntry} historyEntry
   */
  constructor(window, browser, historyEntry) {
    this.#window = window;
    this.#view = new View(this);
    InternalView.viewMap.set(this.#view, this);
    this.update(browser, historyEntry);
  }

  update(browser, historyEntry) {
    this.browserId = browser.browsingContext.id;
    this.historyId = historyEntry.ID;

    this.url = historyEntry.URI;
    this.title = historyEntry.title;
    this.iconURL = browser.mIconURL;

    if (
      Services.prefs.getBoolPref(
        "browser.companion.globalhistorydebugging",
        false
      )
    ) {
      this.historyState = {
        historyId: historyEntry.ID,
        originalURISpec: historyEntry.originalURI?.spec,
        loadReplace: historyEntry.loadReplace,
        hasUserInteraction: historyEntry.hasUserInteraction,
        hasUserActivation: historyEntry.hasUserActivation,
        URIWasModified: historyEntry.URIWasModified,
        persist: historyEntry.persist,
      };
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
 */
class GlobalHistoryEvent extends Event {
  #view;

  /**
   * @param {"ViewChanged" | "ViewAdded" | "ViewMoved" | "ViewRemoved" | "ViewUpdated"} type
   *   The event type.
   * @param {View}
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
  async OnHistoryPurge() {
    await Promise.resolve();
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
   * A vew that is being reloaded;
   * @type {InternalView}
   */
  #pendingView = null;

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
      )
    ) {
      ActorManagerParent.addJSWindowActors(GlobalHistoryActors);
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

    this._onBrowserNavigate(this.#window.gBrowser.selectedBrowser);
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
    this._onBrowserNavigate(newTab.linkedBrowser);
  }

  /**
   * @param {Tab} newTab
   */
  #tabOpened(newTab) {
    let browser = newTab.linkedBrowser;
    this.#watchBrowser(browser);
    this._onBrowserNavigate(browser);
  }

  /**
   * @param {Tab} tab
   * @param {Array} changed
   */
  #tabAttrModified(tab, changed) {
    if (changed.includes("image")) {
      let browser = tab.linkedBrowser;
      this._onNewIcon(browser);
    }
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
    this.dispatchEvent(
      new GlobalHistoryEvent("ViewUpdated", internalView.view)
    );
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
    this.dispatchEvent(
      new GlobalHistoryEvent("ViewUpdated", internalView.view)
    );
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

    if (!internalView && this.#pendingView?.url.spec == newEntry.URI.spec) {
      internalView = this.#pendingView;
      this.#historyViews.delete(internalView.historyId);
      internalView.update(browser, newEntry);
      this.#historyViews.set(internalView.historyId, internalView);
      this.#pendingView = null;
    }

    if (!internalView) {
      // This is a new view.
      internalView = new InternalView(this.#window, browser, newEntry);
      this.#currentIndex = this.#viewStack.length;
      this.#viewStack.push(internalView);
      this.#historyViews.set(newEntry.ID, internalView);

      this.dispatchEvent(
        new GlobalHistoryEvent("ViewAdded", internalView.view)
      );
    } else {
      // This is a navigation to an existing view.
      let pos = this.#viewStack.indexOf(internalView);
      if (pos == this.#currentIndex) {
        // Nothing to do.
        return;
      }

      if (pos < 0) {
        console.warn("Navigated to a view not in the existing stack.");
        this.#currentIndex = this.#viewStack.length;
        this.#viewStack.push(internalView);

        this.dispatchEvent(
          new GlobalHistoryEvent("ViewAdded", internalView.view)
        );
      } else {
        this.#currentIndex = pos;
      }
    }

    this.dispatchEvent(
      new GlobalHistoryEvent("ViewChanged", internalView.view)
    );

    this.#startActivationTimer();
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

    let [internalView] = this.#viewStack.splice(this.#currentIndex, 1);
    this.#viewStack.push(internalView);
    this.#currentIndex = this.#viewStack.length - 1;
    this.dispatchEvent(new GlobalHistoryEvent("ViewMoved", internalView.view));
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

          this.dispatchEvent(
            new GlobalHistoryEvent("ViewRemoved", previousView.view)
          );

          if (this.#currentIndex === null) {
            this.dispatchEvent(new GlobalHistoryEvent("ViewChanged", null));
          }

          return;
        }

        previousView.update(browser, newEntry);
        this.#historyViews.set(newEntry.ID, previousView);

        this.dispatchEvent(
          new GlobalHistoryEvent("ViewUpdated", previousView.view)
        );
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

    // Either the browser is gone or the history entry is gone. In the future we could re-create
    // this, maybe re-using session store. For now just load the url fresh and hackily update the
    // view accordingly.
    this.#pendingView = internalView;
    this.#window.gBrowser.selectedTab = this.#window.gBrowser.addWebTab(
      internalView.url.spec
    );
  }

  /**
   * Whether it is possible to navigate back in the global history.
   * @type {boolean}
   */
  get canGoBack() {
    return this.#currentIndex > 0;
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
