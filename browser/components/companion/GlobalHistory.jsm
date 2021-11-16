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

XPCOMUtils.defineLazyModuleGetters(this, {
  ActorManagerParent: "resource://gre/modules/ActorManagerParent.jsm",
  PageThumbs: "resource://gre/modules/PageThumbs.jsm",
  SessionManager: "resource:///modules/SessionManager.jsm",
  Services: "resource://gre/modules/Services.jsm",
});

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

XPCOMUtils.defineLazyGetter(this, "logConsole", function() {
  return console.createInstance({
    prefix: "GlobalHistory",
    maxLogLevelPref: "browser.companion.globalhistorydebugging.logLevel",
  });
});

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "DEBUG",
  "browser.companion.globalhistorydebugging",
  false
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "INTERSTITIAL_VIEW_OVERWRITING",
  "browser.pinebuild.interstitial-view-overwriting.enabled",
  false
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "INTERSTITIAL_VIEW_OVERWRITING_THRESHOLD_MS",
  "browser.pinebuild.interstitial-view-overwriting.threshold_ms",
  5000
);

const SESSIONSTORE_STATE_KEY = "GlobalHistoryState";
/**
 * @typedef {object} ViewHistoryData
 *   An object containing info about a given view's history entry.
 * @property {Browser|null} browser
 *   The browser the view is displayed in.
 * @property {number|null} historyIndex
 *   Index of the view's history entry in the browser's session history.
 * @property {nsISHistory|null} historyEntry
 *   A view's nsISHistory entry.
 */

// Set to true if we register the TopLevelNavigationDelegate JSWindowActor.
// We record this at the module level so that subsequent browser window
// openings don't try to re-register the same actor (which will throw an
// exception).
let gTopLevelNavigationDelegateRegistered = false;

/**
 * This function returns the index of the nsISHEntry for the document
 * currently loaded in the sessionHistory. If a load is in progress, it
 * returns the index of the nsISHEntry for the loading document.
 *
 * @param {nsISHistory} sessionHistory the nsISHistory to check
 * @returns {number} The index of the loaded or loading document
 *   nsISHEntry
 */
function getCurrentIndex(sessionHistory) {
  return sessionHistory.requestedIndex == -1
    ? sessionHistory.index
    : sessionHistory.requestedIndex;
}

/**
 * This function returns the nsISHEntry for the currently loaded
 * or loading document in a browser.
 * @param {Browser} browser
 */
function getCurrentEntry(browser) {
  let { sessionHistory } = browser.browsingContext;
  let index = getCurrentIndex(sessionHistory);
  if (index < 0) {
    return null;
  }

  return sessionHistory.getEntryAtIndex(index);
}

/**
 * Gets the current index for the history with the given ID in the given browser.
 *
 * @param {Browser} browser
 *   The browser element.
 * @param {number} historyId
 *   The history ID to look for.
 * @returns {number | null}
 *   The index found or null if the entry did not exist or the browser was a lazy browser.
 */
function getHistoryIndex(browser, historyId) {
  if (!browser.browsingContext) {
    return null;
  }

  let { sessionHistory } = browser.browsingContext;

  for (let i = 0; i < sessionHistory.count; i++) {
    let historyEntry = sessionHistory.getEntryAtIndex(i);
    if (historyEntry.ID == historyId) {
      return i;
    }
  }

  return null;
}

/**
 * A single view in the global history. These are intended to be non-mutable.
 */
class View {
  #internalView;

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
    return this.#internalView.userTitle || this.#internalView.title;
  }

  get iconURL() {
    return this.#internalView.iconURL;
  }

  get busy() {
    return this.#internalView.busy;
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
   * Indicates the type of "about" page we've shown in this view.
   * For e.g. certerror, neterror, about:blocked, about:reader, etc.
   * @type {string | null}
   */
  get aboutPageType() {
    return this.#internalView.aboutPageType;
  }

  /**
   * Returns a boolean indicating whether the view is muted.
   */
  get muted() {
    return this.#internalView.muted;
  }

  get pinned() {
    return this.#internalView.pinned;
  }

  get isArticle() {
    return this.#internalView.isArticle;
  }

  get contentPrincipal() {
    return this.#internalView.contentPrincipal;
  }
}

class InternalView {
  /** @type {Number} **/
  #id;

  /** @type {View} */
  #view;

  #window;

  /** @type {boolean} **/
  #pinned;

  /** @type {boolean} **/
  #muted;

  /** @type {boolean} **/
  #isArticle;

  /** @type {nsIPrincipal} **/
  #contentPrincipal;

  /** @type {Number} **/
  #creationTime;

  /**
   * The internal representation of a view. Each view maps to a history entry though the actual
   * history entry may no longer exist.
   *
   * A view can be in one of three states:
   *
   *   * An in-memory view.
   *     - The history entry that this view represents exists in a browser in the current window.
   *     - `cachedEntry` is null.
   *     - `browserId` is the `browserId` for the browser element.
   *     - `browserKey` is the `permanentKey` for the browser element.
   *   * A view in a lazy browser.
   *     - This history entry is tied to a lazy browser and will be re-created when the browser is
   *       restored.
   *     - `cachedEntry` is the session store serialized nsISHEntry as a JS object.
   *     - `browserId` is undefined.
   *     - `browserKey` is the `permanentKey` for the browser element.
   *   * A dropped history entry.
   *     - If the holding browser element is removed or the history entry has been expired somehow.
   *     - `cachedEntry` is the session store serialized nsISHEntry as a JS object.
   *     - `browserId` is undefined.
   *     - `browserKey` is undefined.
   *
   * @param {DOMWindow} window
   *   The top-level DOM window this view is in.
   * @param {Browser | null} browser
   *   The browser element that holds this view or null if this is a view for a discarded entry.
   * @param {nsISHEntry | object} historyEntry
   *   The nsISHEntry for this view or the serialized version if this view is for a lazy or
   *   dropped entry.
   */
  constructor(window, browser, historyEntry) {
    this.#id = InternalView.nextInternalViewID++;
    this.#window = window;
    this.#view = new View(this);
    this.#pinned = false;
    this.#contentPrincipal = Services.scriptSecurityManager.createNullPrincipal(
      {}
    );
    this.#creationTime = Cu.now();

    InternalView.viewMap.set(this.#view, this);

    if (historyEntry instanceof Ci.nsISHEntry) {
      logConsole.debug(
        `Created InternalView ${this.#id} with SHEntry ID: ${historyEntry.ID}`
      );

      this.update(browser, historyEntry);
    } else {
      logConsole.debug(
        `Created InternalView ${this.#id} with ${
          browser ? "lazy" : "cached"
        } SHEntry ID: ` + historyEntry.ID
      );
      this.browserId = browser?.browserId;
      this.browserKey = browser?.permanentKey;

      this.historyId = historyEntry.ID;
      this.cachedEntry = historyEntry;

      this.url = Services.io.newURI(historyEntry.url);
      this.title = historyEntry.title;
      this.iconURL = browser?.mIconURL;
    }
  }

  /**
   * Gets the current browser element for this view. This will return null for a view that has
   * had is history entry dropped.
   *
   * @returns {Browser | null}
   */
  getBrowser() {
    if (!this.browserId && !this.browserKey) {
      return null;
    }

    if (this.browserId) {
      let currentBrowserBC = BrowsingContext.getCurrentTopByBrowserId(
        this.browserId
      );

      let browser = currentBrowserBC?.embedderElement;
      if (browser && this.#window.document.contains(browser)) {
        return browser;
      }

      logConsole.warn(
        `Browser(${this.browserId}) does not exist in this window.`
      );
    }

    for (let browser of this.#window.gBrowser.browsers) {
      if (browser.permanentKey === this.browserKey) {
        return browser;
      }
    }

    logConsole.warn(
      "Failed to find the browser element for still active view."
    );
    logConsole.debug(this.toString());
    return null;
  }

  /**
   * Returns the type of "about" page shown in this view. Note that it only does so in case of
   * "certerror", "neterror", "blocked", "httpsonlyerror" and "reader" pages. These about pages
   * are different in that they indicate the loading state of regular webpages.
   */
  #getAboutPageType(docURI) {
    if (!docURI.schemeIs("about")) {
      return null;
    }

    let aboutPageTypes = ["neterror", "httpsonlyerror", "blocked", "reader"];
    if (
      docURI.filePath == "certerror" ||
      (docURI.filePath == "neterror" &&
        new URLSearchParams(docURI.query).get("e") == "nssFailure2")
    ) {
      return "certerror";
    } else if (aboutPageTypes.includes(docURI.filePath)) {
      return docURI.filePath;
    }

    return null;
  }

  /**
   * Updates this view following some change to the view's properties. This will also convert the
   * view to a real view after being a dropped or lazy view.
   *
   * @param {Browser} browser
   *   The browser element that holds this view.
   * @param {nsISHEntry | object} historyEntry
   *   The nsISHEntry for this view.
   */
  update(browser, historyEntry, options = {}) {
    this.browserId = browser.browserId;
    this.browserKey = browser.permanentKey;
    this.historyId = historyEntry.ID;
    this.cachedEntry = null;

    this.url = historyEntry.URI;
    this.title = historyEntry.title;
    this.iconURL = browser.mIconURL;
    this.busy = this.#window.gBrowser
      .getTabForBrowser(browser)
      ?.hasAttribute("busy");
    this.securityState = browser.securityUI.state;
    this.#contentPrincipal = browser.contentPrincipal;

    let docURI = browser.documentURI;
    if (docURI && docURI.scheme == "about") {
      this.aboutPageType = this.#getAboutPageType(docURI);
    }

    if (options.resetCreationTime) {
      this.#creationTime = Cu.now();
    }

    logConsole.debug(`Updated InternalView ${this.toString()}`);

    if (DEBUG) {
      this.historyState = {
        id: this.#id,
        pinned: this.#pinned,
        loadType: historyEntry.loadType,
        creationTime: this.#creationTime,
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

  /**
   * Called when a browser becomes a lazy browser.
   *
   * @param {object} entry
   *   The serialized history entry.
   */
  discard(entry) {
    this.cachedEntry = entry;
    this.browserId = undefined;
    logConsole.assert(this.browserKey);
  }

  /**
   * Called when the history entry for this view has been removed, either the browser element itself
   * was removed or the history got too long and entries were removed.
   *
   * @param {object} entry
   *   The serialized history entry.
   */
  drop(entry) {
    this.cachedEntry = entry;
    this.browserId = undefined;
    this.browserKey = undefined;
  }

  /** @type {Number} */
  get id() {
    return this.#id;
  }

  /** @type {boolean} */
  get muted() {
    let browser = this.getBrowser();
    return browser?.audioMuted;
  }

  /** @type {boolean} */
  get isArticle() {
    let browser = this.getBrowser();
    return browser?.isArticle;
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
    if (DEBUG) {
      let browser = this.getBrowser();
      let historyIndex = browser
        ? getHistoryIndex(browser, this.historyId)
        : null;
      let historyEntry =
        historyIndex !== null
          ? browser.browsingContext.sessionHistory.getEntryAtIndex(historyIndex)
          : null;

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
    let browser = this.getBrowser();
    let historyIndex = browser
      ? getHistoryIndex(browser, this.historyId)
      : null;

    if (historyIndex !== null) {
      if (
        getCurrentIndex(browser.browsingContext.sessionHistory) == historyIndex
      ) {
        return "open";
      }
      return "cached";
    }

    return "pruned";
  }

  get contentPrincipal() {
    return this.#contentPrincipal;
  }

  /**
   * Returns a high-resolution timestamp for the time at which this
   * InternalView was created or last overwritten due to a quick
   * navigation.
   *
   * @type {Number}
   */
  get creationTime() {
    return this.#creationTime;
  }

  toString() {
    return (
      `{ (${this.#id}) bc: ${this.browserId}, SHEntry: ${this.historyId} ` +
      `${this.title} - ${this.url.spec} }`
    );
  }

  /** @type {WeakMap<View, InternalView>} */
  static viewMap = new WeakMap();

  static nextInternalViewID = 1;
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
  #detail;

  /**
   * @param {"ViewChanged" | "ViewAdded" | "ViewMoved" | "ViewRemoved" | "ViewUpdated" | "RiverRebuilt"} type
   *   The event type.
   * @param {View | null}
   *   The related view.
   * @param {Object | null}
   *   Any related detail information for the event.
   */
  constructor(type, view, detail = {}) {
    super(type);
    this.#view = view;
    this.#detail = detail;

    if (view && !(view instanceof View)) {
      logConsole.error("Emitting a global history event with a non-view", view);
    }
  }

  /**
   * The view that this event refers to.
   * @type {View}
   */
  get view() {
    return this.#view;
  }

  /**
   * Optional detail information about the GlobalHistoryEvent.
   * @type {Object}
   */
  get detail() {
    return this.#detail;
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
    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryNewEntry: ` +
        `${newURI.spec}`
    );
    await Promise.resolve();

    this.#globalHistory._onBrowserNavigate(this.#browser);
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryReload() {
    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryReload`
    );
    await Promise.resolve();
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryGotoIndex() {
    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryGotoIndex`
    );
    await Promise.resolve();

    this.#globalHistory._onBrowserNavigate(this.#browser);
  }

  /**
   * See nsISHistoryListener
   */
  OnHistoryPurge(numEntries) {
    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryPurge: ` +
        numEntries
    );
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
    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryTruncate: ` +
        numEntries
    );

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
    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryReplaceEntry`
    );
    let { sessionHistory } = this.#browser.browsingContext;
    let previousEntry = sessionHistory.getEntryAtIndex(
      getCurrentIndex(sessionHistory)
    );

    await Promise.resolve();

    let newEntry = getCurrentEntry(this.#browser);

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
   * True if our most recent navigation was forward in the global history.
   */
  #navigatingForward = false;

  /**
   * True if the history carousel is currently visible in the window.
   */
  #historyCarouselMode = false;

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
  }

  /**
   * Called once the DOM is ready, and we know that gBrowser is available.
   */
  init() {
    for (let { linkedBrowser: browser } of this.#window.gBrowser.tabs) {
      this.#watchBrowser(browser);
    }

    this.#window.gBrowser.tabContainer.addEventListener("TabSelect", event =>
      this.#tabSelected(event.target)
    );

    this.#window.gBrowser.tabContainer.addEventListener("TabOpen", event =>
      this.#tabOpened(event.target)
    );

    this.#window.gBrowser.tabContainer.addEventListener("TabClose", event =>
      this.#tabClosed(event.target)
    );

    this.#window.gBrowser.tabContainer.addEventListener(
      "TabAttrModified",
      event => this.#tabAttrModified(event.target, event.detail.changed)
    );

    this.#window.gBrowser.tabContainer.addEventListener(
      "SSTabRestoring",
      event => this.#tabRestored(event.target)
    );

    this.#window.gBrowser.tabContainer.addEventListener(
      "TabBrowserDiscarded",
      event => this.#tabDiscarded(event.target)
    );

    this.#window.addEventListener("SSWindowRestoring", () =>
      this.#sessionRestoreStarted()
    );

    this.#window.gBrowser.addTabsProgressListener(this);
  }

  /**
   * Clears all the current tabs, and ensures the history is blank.
   *
   * @param {object} [options]
   * @param {string} [options.url]
   *   An optional url to load default tab content.
   * @param {boolean} [options.skipPermitUnload]
   *   Set to true if it is ok to skip the before unload handlers when closing
   *   tabs (e.g. tabbrowser.runBeforeUnloadForTabs() has been called).
   */
  reset({
    url = this.#window.BROWSER_NEW_TAB_URL,
    skipPermitUnload = false,
  } = {}) {
    let newTab = this.#window.gBrowser.addTrustedTab(url);
    this.#window.gBrowser.selectedTab = newTab;
    this.#window.gBrowser.removeAllTabsBut(newTab, {
      animate: false,
      skipPermitUnload,
    });
    this.#viewStack = [];
    this.#historyViews.clear();
    this.#currentIndex = null;
    this.#notifyEvent("RiverRebuilt");
  }

  onSecurityChange(browser, webProgress, request, status) {
    let entry = getCurrentEntry(browser);
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
   * @param {Object | null} detail Optional detail information to include with
   *   the event.
   */
  #notifyEvent(type, internalView, detail) {
    this.dispatchEvent(
      new GlobalHistoryEvent(type, internalView?.view, detail)
    );
  }

  #sessionRestoreStarted() {
    logConsole.debug("Session restore started.");

    // Window is starting restoration, stop listening to everything.
    this.#windowRestoring = true;

    if (this.#activationTimer) {
      this.clearActivationTimer();
    }

    for (let { linkedBrowser: browser } of this.#window.gBrowser.tabs) {
      let listener = this.#browsers.get(browser);
      if (listener) {
        try {
          browser.browsingContext.sessionHistory.removeSHistoryListener(
            listener
          );
        } catch (e) {
          logConsole.error("Failed to remove listener", e);
        }
      }
    }

    this.#browsers = new WeakMap();

    this.#window.addEventListener(
      "SSWindowRestored",
      () => {
        this.#sessionRestoreEnded();
      },
      { once: true }
    );
  }

  #tabRestored(tab) {
    logConsole.debug("Saw a tab restored");

    let { sessionHistory } = tab.linkedBrowser.browsingContext;
    for (let i = 0; i < sessionHistory.count; i++) {
      let entry = sessionHistory.getEntryAtIndex(i);
      let entryId = SessionHistory.getPreviousID(entry) ?? entry.ID;

      let internalView = this.#historyViews.get(entryId);
      if (internalView) {
        if (entry.ID != entryId) {
          this.#historyViews.delete(entryId);
          this.#historyViews.set(entry.ID, internalView);
        }

        internalView.update(tab.linkedBrowser, entry);
      }
    }

    this.#watchBrowser(tab.linkedBrowser);
  }

  #tabDiscarded(tab) {
    logConsole.debug("Saw a tab discarded");

    // At this point the browser has already lost its history state so update from session store.
    let state = JSON.parse(SessionStore.getTabState(tab));
    for (let entry of state.entries) {
      let internalView = this.#historyViews.get(entry.ID);
      if (internalView) {
        internalView.discard(entry);
      }
    }
  }

  #sessionRestoreEnded() {
    logConsole.debug("Session restore ended.");
    // Session restore is done, rebuild everything from the new state.
    this.#windowRestoring = false;

    let stateStr = SessionStore.getCustomWindowValue(
      this.#window,
      SESSIONSTORE_STATE_KEY
    );

    this.#viewStack = [];
    this.#historyViews.clear();

    // Tabs are not yet functional so build a set of views from cached history state.
    let state = [];
    if (stateStr) {
      try {
        state = JSON.parse(stateStr);
      } catch (e) {
        logConsole.warn("Failed to deserialize global history state.", e);
      }
    }

    if (!state.length) {
      logConsole.error("No state to rebuild from.");
    }

    logConsole.debug(
      "Attempting to restore views for history entries",
      state.map(entry => entry.id)
    );

    let missingIds = new Set();
    let previousIdMap = new Map();
    for (let { id, cachedEntry } of state) {
      if (cachedEntry) {
        let internalView = new InternalView(this.#window, null, cachedEntry);
        this.#historyViews.set(id, internalView);
        previousIdMap.set(id, internalView);
      } else {
        missingIds.add(id);
      }
    }

    if (previousIdMap.size) {
      logConsole.debug("Found cached history entries", [
        ...previousIdMap.keys(),
      ]);
    }

    let restoredIds = [];
    let pendingIds = [];
    for (let tab of this.#window.gBrowser.tabs) {
      if (tab.linkedBrowser.browsingContext) {
        // This browser is already restored
        let { sessionHistory } = tab.linkedBrowser.browsingContext;
        for (let i = 0; i < sessionHistory.count; i++) {
          let entry = sessionHistory.getEntryAtIndex(i);
          let entryId = SessionHistory.getPreviousID(entry) ?? entry.ID;

          if (missingIds.has(entryId)) {
            let internalView = new InternalView(
              this.#window,
              tab.linkedBrowser,
              entry
            );
            this.#historyViews.set(entry.ID, internalView);
            previousIdMap.set(entryId, internalView);
            restoredIds.push(entryId);
            missingIds.delete(entryId);
          }
        }
      } else {
        let tabState = JSON.parse(SessionStore.getTabState(tab));
        for (let entry of tabState.entries) {
          if (missingIds.has(entry.ID)) {
            let internalView = new InternalView(
              this.#window,
              tab.linkedBrowser,
              entry
            );
            this.#historyViews.set(entry.ID, internalView);
            previousIdMap.set(entry.ID, internalView);
            pendingIds.push(entry.ID);
            missingIds.delete(entry.ID);
          }
        }
      }
    }

    if (restoredIds.size) {
      logConsole.debug("Found already restored history entries", restoredIds);
    }
    if (pendingIds.size) {
      logConsole.debug("Found history entries in pending tabs", pendingIds);
    }
    if (missingIds.size) {
      logConsole.debug("Failed to find history state for ids", [...missingIds]);
    }

    // Push those views onto the stack and to the river.
    for (let { id } of state) {
      let internalView = previousIdMap.get(id);
      if (!internalView) {
        logConsole.warn("Missing history entry for river entry.");
        continue;
      }

      this.#viewStack.push(internalView);
    }

    let selectedBrowser = this.#window.gBrowser.selectedBrowser;
    let selectedEntry = getCurrentEntry(selectedBrowser);
    let selectedView = this.#historyViews.get(selectedEntry.ID);

    if (!selectedView) {
      logConsole.warn("Selected entry was not in state.");
      selectedView = new InternalView(
        this.#window,
        selectedBrowser,
        selectedEntry
      );
      this.#historyViews.set(selectedEntry.ID, selectedView);

      this.#viewStack.push(selectedView);
    }

    // Mark the correct view.
    this.#currentIndex = this.#viewStack.indexOf(selectedView);
    this.#notifyEvent("RiverRebuilt", selectedView);

    this.startActivationTimer();
    this.#updateSessionStore();
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
      logConsole.error("Failed to add listener", e);
    }
  }

  /**
   * @param {Tab} newTab
   */
  #tabSelected(newTab) {
    if (this.#windowRestoring) {
      return;
    }

    logConsole.debug(
      `Browser(${newTab.linkedBrowser.browsingContext.id}) staged.`
    );

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

    logConsole.debug(`Browser(${browser.browsingContext.id}) created.`);

    this.#watchBrowser(browser);
    this._onBrowserNavigate(browser);
  }

  /**
   * @param {Tab} closingTab
   */
  #tabClosed(closingTab) {
    // If we're closing the special OAuth tab, blow away any Views
    // associated with it.
    if (closingTab.getAttribute("pinebuild-oauth-flow")) {
      let browser = closingTab.linkedBrowser;
      // We iterate the Views in reverse order because we're going to
      // be removing some along the way, and we don't want to worry
      // about shifting indexes while we do it.
      for (let i = this.#viewStack.length - 1; i >= 0; --i) {
        let view = this.#viewStack[i];
        if (view.browserId == browser.browserId) {
          this.#closeInternalView(view);
        }
      }
    }
  }

  /**
   * @param {Tab} tab
   * @param {Array} changed
   */
  #tabAttrModified(tab, changed) {
    if (this.#windowRestoring) {
      return;
    }

    let browser = tab.linkedBrowser;
    if (changed.includes("image")) {
      this._onNewIcon(browser);
    } else if (changed.includes("busy")) {
      this._onBusyChanged(browser, tab.hasAttribute("busy"));
    }
  }

  /**
   * Called when some nsISHEntry's have been removed from a browser
   * being listened to.
   *
   * @param {object[]} entries The serialized entries that were removed.
   */
  _onHistoryEntriesRemoved(entries) {
    for (let entry of entries) {
      let internalView = this.#historyViews.get(entry.ID);
      if (internalView) {
        internalView.drop(entry);
      }
    }

    this.#updateSessionStore();
  }

  /**
   * Called when the document in a browser has changed title.
   */
  _onNewTitle(browser) {
    let entry = getCurrentEntry(browser);
    let internalView = this.#historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.title = entry.title;
    this.#notifyEvent("ViewUpdated", internalView);
  }

  /**
   * Called when a user changes a page's title.
   */
  updateUserTitle(view, userTitle) {
    let internalView = InternalView.viewMap.get(view);
    if (!internalView) {
      return;
    }

    internalView.userTitle = userTitle;
    this.#notifyEvent("ViewUpdated", internalView);
  }

  /**
   * Called when the document in a browser has changed its favicon.
   */
  _onNewIcon(browser) {
    let entry = getCurrentEntry(browser);
    if (!entry) {
      return;
    }
    let internalView = this.#historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.iconURL = browser.mIconURL;
    this.#notifyEvent("ViewUpdated", internalView);
  }

  /**
   * Called when the browser's busy state has changed.
   */
  _onBusyChanged(browser, busy) {
    let entry = getCurrentEntry(browser);
    if (!entry) {
      return;
    }
    let internalView = this.#historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.busy = busy;
    this.#notifyEvent("ViewUpdated", internalView);
  }

  /**
   * Called when a browser loads a view.
   *
   * @param {Browser} browser
   * @param {nsISHEntry} newEntry
   */
  _onBrowserNavigate(browser, newEntry = getCurrentEntry(browser)) {
    logConsole.group(
      `_onBrowserNavigate for browser(${browser.browsingContext.id}), ` +
        `SHEntry(${newEntry?.ID})`
    );
    if (!newEntry) {
      logConsole.debug("No newEntry");
      logConsole.groupEnd();
      // Happens before anything has been loaded into the browser.
      return;
    }

    if (this.#window.gBrowser.selectedBrowser !== browser) {
      // Only care about the currently visible browser. We will re-visit if the tab is selected.
      logConsole.debug("Browser is not selected.");
      logConsole.groupEnd();
      return;
    }

    if (this.#window.isInitialPage(newEntry.URI)) {
      // Don't store initial pages in the river.
      logConsole.debug(
        "SHEntry is pointed at an initial or ignored page: ",
        newEntry.URI.spec
      );
      logConsole.groupEnd();
      this.#currentIndex = null;
      return;
    }

    let { internalView, overwriting } = this.#findInternalViewToNavigate(
      browser,
      newEntry
    );

    if (!internalView) {
      // More than once, we've stumbled onto some bugs where a new InternalView
      // gets created with an SHEntry that maps to a pre-existing InternalView.
      // While we've fixed a good number of these cases, to make it easier to
      // detect if more cases exist, we make a little bit of noise when debugging
      // when that duplication arises.
      if (DEBUG) {
        let preexisting = this.#viewStack.find(v => v.historyId == newEntry.ID);
        logConsole.assert(
          !preexisting,
          `Should not find a pre-existing InternalView with SHEntry ID ${newEntry.ID}`
        );
        if (preexisting) {
          logConsole.debug(JSON.parse(JSON.stringify(this.#viewStack)));
          logConsole.debug(
            JSON.parse(JSON.stringify([...this.#historyViews.entries()]))
          );
        }
      }

      logConsole.debug(`Creating a new InternalView.`);

      // This is a new view.
      internalView = new InternalView(this.#window, browser, newEntry);
      this.#currentIndex = this.#viewStack.length;
      this.#viewStack.push(internalView);
      this.#historyViews.set(newEntry.ID, internalView);

      SessionManager.register(this.#window, internalView.url).catch(
        logConsole.error
      );

      this.#notifyEvent("ViewAdded", internalView);
    } else {
      logConsole.debug(`Updating InternalView ${internalView.toString()}.`);
      // This is a navigation to an existing view.
      internalView.update(browser, newEntry, {
        resetCreationTime: overwriting,
      });

      let pos = this.#viewStack.indexOf(internalView);
      if (pos == this.#currentIndex) {
        logConsole.debug(`Updated InternalView is the current index.`);
        logConsole.groupEnd();
        this.#notifyEvent("ViewUpdated", internalView);
        return;
      }

      if (pos < 0) {
        logConsole.warn("Navigated to a view not in the existing stack.");
        this.#currentIndex = this.#viewStack.length;
        this.#viewStack.push(internalView);

        this.#notifyEvent("ViewAdded", internalView);
      } else {
        this.#currentIndex = pos;
        logConsole.debug(`Setting currentIndex to ${this.#currentIndex}.`);
      }
    }

    this.startActivationTimer();
    this.#updateSessionStore();
    this.#notifyEvent("ViewChanged", internalView);

    logConsole.groupEnd();
  }

  /**
   * @typedef {object} FindInternalViewResult
   *   A result returned from #findInternalViewToNavigate when searching for
   *   the right InternalView to navigate.
   * @property {InternalView|null} browser
   *   The InternalView that was found to navigate. Null if no appropriate
   *   InternalView was found.
   * @property {boolean} overwriting
   *   True if the InternalView that was found qualifies for overwriting due
   *   to a quick navigation.
   */

  /**
   * Determines which, if any, pre-existing InternalView should be updated
   * for a navigation to newEntry from browser. If it can't find an
   * appropriate InternalView to update, this will return null.
   *
   * @param {Browser} browser
   * @param {nsISHEntry} newEntry
   * @returns {FindInternalViewResult}
   */
  #findInternalViewToNavigate(browser, newEntry) {
    let internalView = this.#historyViews.get(newEntry.ID);
    if (internalView) {
      return { internalView, overwriting: false };
    }

    logConsole.debug(
      `Did not initially find InternalView with ID: ${newEntry.ID}.`
    );
    // It's possible that a session restoration has resulted in a new
    // nsISHEntry being created with a new ID that doesn't match the one
    // we're looking for. Thankfully, SessionHistory keeps track of this,
    // so we can try to map the new nsISHEntry's ID to the previous ID,
    // and then update our references to use the new ID.
    let previousID = SessionHistory.getPreviousID(newEntry);
    if (previousID) {
      logConsole.debug(`Found previous SHEntry ID: ${previousID}`);
      internalView = this.#historyViews.get(previousID);
      if (internalView) {
        logConsole.debug(`Found InternalView ${internalView.toString()}`);
        this.#historyViews.delete(previousID);
        this.#historyViews.set(newEntry.ID, internalView);
        return { internalView, overwriting: false };
      }
    }

    if (this.#pendingView?.url.spec == newEntry.URI.spec) {
      logConsole.debug(
        `Found pending InternalView ${this.#pendingView.toString()}.`
      );
      internalView = this.#pendingView;
      this.#historyViews.delete(internalView.historyId);
      this.#historyViews.set(newEntry.ID, internalView);
      this.#pendingView = null;
      return { internalView, overwriting: false };
    }

    if (INTERSTITIAL_VIEW_OVERWRITING) {
      // For quick navigations (for example, bounces through an OAuth
      // provider), we want to avoid creating extra InternalViews
      // unnecessarily, as the user is unlikely to want to return to
      // them. We check to see if the previous InternalView for this
      // browser is considered a quick navigation, and if so, we return
      // that for overwriting.
      let newEntryHistoryIndex = getHistoryIndex(browser, newEntry.ID);
      let previousEntryHistoryIndex = newEntryHistoryIndex - 1;

      if (previousEntryHistoryIndex >= 0) {
        let { sessionHistory, currentWindowGlobal } = browser.browsingContext;
        let previousEntry = sessionHistory.getEntryAtIndex(
          previousEntryHistoryIndex
        );
        if (previousEntry) {
          let previousView = this.#historyViews.get(previousEntry.ID);
          if (previousView) {
            let timeSinceCreation = Cu.now() - previousView.creationTime;
            if (
              !currentWindowGlobal.isInitialDocument &&
              !previousEntry.hasUserInteraction &&
              timeSinceCreation < INTERSTITIAL_VIEW_OVERWRITING_THRESHOLD_MS
            ) {
              logConsole.debug(
                `Overwriting InternalView ${previousView.toString()} due to quick ` +
                  `navigation`
              );
              // We're going to be calling into `update` again shortly in
              // _onBrowserNavigate anyways
              this.#historyViews.delete(previousView.historyId);
              this.#historyViews.set(newEntry.ID, previousView);
              return { internalView: previousView, overwriting: true };
            }
          }
        }
      }
    }

    return { internalView: null, overwriting: false };
  }

  clearActivationTimer() {
    this.#window.clearTimeout(this.#activationTimer);
  }

  startActivationTimer() {
    if (this.#activationTimer) {
      this.clearActivationTimer();
    }

    let timeout = GlobalHistory.activationTimeout;
    if (timeout == 0) {
      return;
    }

    logConsole.debug(`Starting activation timer.`);
    this.#activationTimer = this.#window.setTimeout(() => {
      this.#activateCurrentView();
    }, timeout);
  }

  #activateCurrentView() {
    logConsole.debug(`Activating current InternalView.`);
    this.#activationTimer = null;
    if (
      this.#currentIndex === null ||
      this.#currentIndex == this.#viewStack.length - 1
    ) {
      logConsole.debug(`Cannot activate index: ${this.#currentIndex}.`);
      return;
    }

    if (this.currentView.pinned) {
      logConsole.debug(`Cannot activate a pinned InternalView.`);
      return;
    }

    let [internalView] = this.#viewStack.splice(this.#currentIndex, 1);
    this.#viewStack.push(internalView);
    this.#currentIndex = this.#viewStack.length - 1;
    this.#notifyEvent("ViewMoved", internalView);
    this.#updateSessionStore();
    logConsole.debug(`Activated InternalView ${internalView.toString()}`);
  }

  /**
   * Called when a new history entry replaces an older one.
   *
   * @param {Browser} browser
   * @param {nsISHEntry} previousEntry
   * @param {nsISHEntry} newEntry
   */
  _onBrowserReplace(browser, previousEntry, newEntry) {
    logConsole.debug(
      `_onBrowserReplace for browser(${browser.browsingContext.id}), ` +
        `previous SHEntry(${previousEntry.ID}), new SHEntry(${newEntry.ID})`
    );
    let previousView = this.#historyViews.get(previousEntry.ID);
    if (previousView) {
      logConsole.debug(
        `Found previous InternalView: ${previousView.toString()}`
      );
      this.#historyViews.delete(previousEntry.ID);

      let pos = this.#viewStack.indexOf(previousView);
      if (pos >= 0) {
        if (this.#window.isInitialPage(newEntry.URI)) {
          logConsole.debug(
            `Previous InternalView was at internal page - discarding.`
          );
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
      logConsole.error(
        `Could not find InternalView ${previousView.toString()} in ` +
          `the #viewStack.`
      );
    }

    // Fallback in the event that the previous entry is not present in the stack.
    logConsole.debug("Falling back to _onBrowserNavigate.");
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
    if (!DEBUG) {
      return null;
    }

    return [...this.#viewStack];
  }

  /**
   * Returns the currently displayed View or null if there is no current View.
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
  setView(view) {
    logConsole.debug("Setting a new View as current.");
    let internalView = InternalView.viewMap.get(view);
    if (!internalView) {
      throw new Error("Unknown view.");
    }

    logConsole.debug(
      `Setting current InternalView to ${internalView.toString()}`
    );

    let pos = this.#viewStack.indexOf(internalView);
    if (pos == -1) {
      throw new Error("Unknown View.");
    }

    // If we're showing the history carousel, then we don't actually want
    // to change the staged View - but we do want to update the AVM with the
    // selection.
    if (this.#historyCarouselMode) {
      this.#notifyEvent("ViewChanged", internalView);
      return;
    }

    this.#navigatingForward = pos > this.#currentIndex;

    if (this.#currentIndex == pos) {
      // Nothing to do.
      logConsole.debug("InternalView is already current.");
      return;
    }

    let browser = internalView.getBrowser();

    if (browser) {
      if (!browser.browsingContext) {
        // This is a lazy browser, trigger restoration.
        let tab = this.#window.gBrowser.getTabForBrowser(browser);
        let state = JSON.parse(SessionStore.getTabState(tab));

        for (let i = 0; i < state.entries.length; i++) {
          if (state.entries[i].ID == internalView.historyId) {
            // Update state before triggering restoration so the correct page loads immediately.
            if (state.index != i + 1) {
              state.index = i + 1;
              SessionStore.setTabState(tab, state);
            }

            // Selecting the browser will trigger session restoration and page load with will be
            // detected and send out the ViewChanged notification elsewhere.
            logConsole.debug(`Putting lazy browser on the stage.`);
            this.#window.gBrowser.selectedTab = tab;
            return;
          }
        }
      } else {
        let historyIndex = getHistoryIndex(browser, internalView.historyId);

        if (historyIndex !== null) {
          logConsole.debug(
            `Found historyIndex ${historyIndex} for InternalView.`
          );

          // Navigate if necessary.
          let currentIndex = getCurrentIndex(
            browser.browsingContext.sessionHistory
          );

          if (currentIndex != historyIndex) {
            logConsole.debug(
              `Navigating browser ${browser.browsingContext.id} to SHistory ` +
                `index ${historyIndex}.`
            );
            browser.gotoIndex(historyIndex);
          }

          // Tab switch if necessary.
          if (this.#window.gBrowser.selectedBrowser !== browser) {
            logConsole.debug(
              `Putting browser ${browser.browsingContext.id} on the stage.`
            );
            let tab = this.#window.gBrowser.getTabForBrowser(browser);
            this.#window.gBrowser.selectedTab = tab;
          }

          // The history navigation/tab switch should be detected and send out the ViewChanged
          // notification.
          return;
        }
      }

      logConsole.warn(
        `Failed to recover history for a view ${internalView.toString()}`
      );
    }

    let { cachedEntry } = internalView;
    if (cachedEntry) {
      logConsole.debug(
        `Found cached SHEntry ${cachedEntry.ID} for InternalView. ` +
          `Creating and staging a new browser for it.`
      );
      let tab = this.#window.gBrowser.addTrustedTab("about:blank", {
        skipAnimation: true,
      });

      let newBrowser = tab.linkedBrowser;

      SessionHistory.restoreFromParent(
        newBrowser.browsingContext.sessionHistory,
        {
          entries: [cachedEntry],
        }
      );

      newBrowser.gotoIndex(0);

      logConsole.debug(
        `Created and staged browser ${newBrowser.browsingContext.id}.`
      );
      this.#window.gBrowser.selectedTab = tab;
      return;
    }

    // Either the browser is gone or the history entry is gone and for some reason we have no cache
    // of the session.
    logConsole.warn("Recreating a view with no cached entry.");
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
   * @param {Number | null} index The index within the Pinned Views section
   *   of the #viewStack to put the Pinned View. Defaults to 0.
   */
  setViewPinnedState(view, shouldPin, index = 0) {
    if (!Services.prefs.getBoolPref("browser.river.pinning.enabled", false)) {
      return;
    }

    let internalView = InternalView.viewMap.get(view);
    if (!internalView) {
      throw new Error("Unknown view.");
    }

    let pinnedViewCount = this.pinnedViewCount;
    if (index > pinnedViewCount) {
      throw new Error(
        "Cannot pin at an index greater than the number of pinned Views"
      );
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
    let detail = {};

    if (shouldPin) {
      this.#viewStack.splice(index, 0, internalView);
      eventName = "ViewPinned";
      detail.index = index;
    } else {
      this.#viewStack.push(internalView);
      eventName = "ViewUnpinned";
    }

    internalView.pinned = shouldPin;

    // Now that #viewStack has updated, make sure that #currentIndex correctly
    // points at currentView.
    this.#currentIndex = this.#viewStack.indexOf(currentView);
    this.#notifyEvent(eventName, internalView, detail);
  }

  /**
   * @type {number} The number of pinned Views in this window.
   */
  get pinnedViewCount() {
    let index;
    for (index = 0; index < this.#viewStack.length; index++) {
      if (!this.#viewStack[index].pinned) {
        break;
      }
    }
    return index;
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

  /**
   * True if the most recent navigation was forward in the global history.
   * @returns {bool}
   */
  get navigatingForward() {
    return !!this.#navigatingForward;
  }

  /**
   * Public method for removing a View from GlobalHistory.
   *
   * @param {View} view The View to close.
   */
  closeView(view) {
    let internalView = InternalView.viewMap.get(view);
    if (!internalView) {
      throw new Error("Unknown view.");
    }

    this.#closeInternalView(internalView);
  }

  /**
   * Removes the passed in InternalView from the current #viewStack,
   * cleans up any leftover resources from the InternalView, and then
   * fires the ViewRemoved event so that the UI can update the
   * visualization of Views.
   *
   * @param {InternalView} internalView The InternalView to close.
   */
  #closeInternalView(internalView) {
    let index = this.#viewStack.indexOf(internalView);
    if (index == -1) {
      throw new Error("Could not find the View in the #viewStack");
    }

    // First, attempt to switch to the next View
    let viewToSwitchTo = this.#viewStack[index + 1];

    // If no such View exists, then go to the previous View instead.
    if (!viewToSwitchTo) {
      viewToSwitchTo = this.#viewStack[index - 1];
    }

    // If the View we're closing is pinned, and the View that
    // we've selected to switch to isn't pinned, then we must
    // have run out of pinned Views. In that case, just switch
    // to the last View in the River.
    if (internalView.pinned && viewToSwitchTo && !viewToSwitchTo.pinned) {
      viewToSwitchTo = this.#viewStack[this.#viewStack.length - 1];
    }

    // If none of that was possible, then we conclude that we're closing
    // the last View and do a reset.
    if (!viewToSwitchTo) {
      this.#notifyEvent("ViewRemoved", internalView);
      this.reset();
      return;
    }

    this.setView(viewToSwitchTo.view);

    let { browser } = internalView;
    // If the associated <browser> only had a single entry in it,
    // then presumably it was for the history entry of the View
    // that just removed. In that case, we can get rid of that
    // <browser>.
    if (browser?.browsingContext.sessionHistory.count == 1) {
      let tab = this.#window.gBrowser.getTabForBrowser(browser);
      this.#window.gBrowser.removeTab(tab, { animate: false });
    }

    this.#viewStack.splice(index, 1);
    this.#historyViews.delete(internalView.historyId);
    this.#notifyEvent("ViewRemoved", internalView);

    // Right now, we assume that the internalView was the current
    // View when closing. This means that it's possible that after
    // splicing the closed View out of the #viewStack, that the
    // currentIndex will match the _new_ index of the viewToSwitchTo
    // if the viewToSwitchTo was positioned _after_ the InternalView
    // that was removed. If we detect that case, we'll fire the
    // ViewChanged event to signal to the front-end to update the
    // visualization of the currentView.
    let pos = this.#viewStack.indexOf(viewToSwitchTo);
    if (this.#currentIndex == pos) {
      this.#notifyEvent("ViewChanged", viewToSwitchTo);
    }
  }

  /**
   * Sets up or tears down the history carousel for the current window.
   *
   * @param {Boolean} shouldShow
   *   True if the carousel should be shown.
   * @returns {Promise}
   * @resolves {undefined}
   *   Resolves once the state has been entered (or if we're already in the
   *   selected state).
   */
  async showHistoryCarousel(shouldShow) {
    if (this.#historyCarouselMode == shouldShow) {
      return;
    }

    logConsole.debug("Show history carousel: ", shouldShow);

    if (this.#viewStack.length <= 1) {
      throw new Error(
        "Cannot enter history carousel mode without multiple views"
      );
    }

    let gBrowser = this.#window.gBrowser;

    if (shouldShow) {
      this.#historyCarouselMode = shouldShow;
      logConsole.debug("Adding history carousel browser");
      let tab = gBrowser.addTrustedTab("about:historycarousel", {
        skipAnimation: true,
      });

      logConsole.debug("Waiting for history carousel browser to be ready");

      await new Promise(resolve => {
        let listener = e => {
          resolve();
        };
        this.#window.addEventListener("HistoryCarousel:Ready", listener, {
          once: true,
        });
      });

      logConsole.debug("History carousel browser is ready. Making visible.");
      gBrowser.selectedTab = tab;
    } else {
      if (gBrowser.selectedBrowser.currentURI.spec != "about:historycarousel") {
        throw new Error("Selected <browser> should be the carousel.");
      }
      let carouselTab = gBrowser.selectedTab;
      let actor = gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor(
        "HistoryCarousel"
      );
      let finalIndex = await actor.sendQuery("Exit");

      this.#historyCarouselMode = shouldShow;

      let internalView = this.#viewStack[finalIndex];
      this.setView(internalView.view);

      logConsole.debug("Removing history carousel browser.");
      gBrowser.removeTab(carouselTab, { animate: false });
    }
  }

  /**
   * Sets the currently selected View, but only works if we're currently
   * viewing the history carousel. This is the correct way for the carousel
   * to update the current View selection.
   *
   * @param {Number} index
   *   The index of the View to make the current selection.
   */
  setHistoryCarouselIndex(index) {
    logConsole.assert(
      this.#historyCarouselMode,
      "Should only receive this in History Carousel mode"
    );
    if (!this.#historyCarouselMode) {
      return;
    }

    let internalView = this.#viewStack[index];
    this.setView(internalView.view);
  }

  /**
   * @typedef {object} HistoryCarouselData
   *   An object that contains information to render a single View in the
   *   history carousel.
   * @property {String} title
   *   The View's title.
   * @property {String} url
   *   The View's URL as a string.
   * @property {String} iconURL
   *   The View's favicon URL as a string.
   * @property {Blob} image
   *   A viewport screenshot of the View as a blob.
   */

  /**
   * @typedef {object} InitialHistoryCarouselData
   *   An object containing enough information to render the currently
   *   selected View and empty slots for the remaining Views.
   * @property {Number} currentIndex
   *   The currentIndex of the selected View.
   * @property {HistoryCarouselData|null[]} previews
   *   An array that contains empty slots for every View except for the
   *   currently selected View - that slot contains HistoryCarouselData for
   *   that View. This array is in the same order as the #viewStack.
   */

  /**
   * Returns a Promise that resolves with enough information for the history
   * carousel to render the currently selected View and empty slots for every
   * other View.
   *
   * @returns {Promise}
   * @resolves {InitialHistoryCarouselData}
   *   Resolves once the state has been entered (or if we're already in the
   *   selected state).
   */
  async getInitialHistoryCarouselData() {
    let viewCount = this.#viewStack.length - this.pinnedViewCount;

    let data = {
      currentIndex: this.#currentIndex,
      previews: new Array(viewCount),
    };

    for (let i = 0; i < this.#viewStack.length; ++i) {
      data.previews[i] = {
        title: this.#viewStack[i].title,
        url: this.#viewStack[i].url.spec,
        iconURL: this.#viewStack[i].iconURL,
        image: null,
      };
    }

    let currentInternalView = this.#viewStack[this.#currentIndex];
    let currentBrowser = currentInternalView.getBrowser();
    data.previews[this.#currentIndex].image = await PageThumbs.captureToBlob(
      currentBrowser,
      {
        fullScale: true,
        fullViewport: true,
      }
    );

    return data;
  }

  /**
   * Returns a Promise that resolves with HistoryCarouselData for a View at
   * a particular View in the #viewStack.
   *
   * @param {Number} index
   *   The index of the View to get the HistoryCarouselData for.
   * @returns {Promise}
   * @resolves {InitialHistoryCarouselData|null}
   *   Resolves once the viewport screenshot has been captured. Resolves
   *   with null if the View is not currently loaded in memory.
   */
  async getHistoryCarouselDataForIndex(index) {
    let internalView = this.#viewStack[index];
    if (internalView.state == "open") {
      return PageThumbs.captureToBlob(internalView.getBrowser(), {
        fullScale: true,
        fullViewport: true,
      });
    }
    return null;
  }
}

XPCOMUtils.defineLazyPreferenceGetter(
  GlobalHistory,
  "activationTimeout",
  "browser.river.activationTimeout",
  5000
);
