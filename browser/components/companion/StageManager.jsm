/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["StageManager"];

/**
 * This component tracks the views that a user visits. Instances of StageManager track the views
 * for a single top-level window.
 */
const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  E10SUtils: "resource://gre/modules/E10SUtils.jsm",
  PageThumbs: "resource://gre/modules/PageThumbs.jsm",
  SessionManager: "resource:///modules/SessionManager.jsm",
  Services: "resource://gre/modules/Services.jsm",
  Snapshots: "resource:///modules/Snapshots.jsm",
  TabStateFlusher: "resource:///modules/sessionstore/TabStateFlusher.jsm",
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
    prefix: "StageManager",
    maxLogLevelPref: "browser.companion.stagemanagerdebugging.logLevel",
  });
});

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "DEBUG",
  "browser.companion.stagemanagerdebugging",
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

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "LOGIN_VIEW_OVERWRITING",
  "browser.pinebuild.login-view-overwriting.enabled",
  false
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "MAX_RIVER_GROUPS",
  "browser.river.maxGroups",
  5
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "OPEN_NEW_TAB_FOR_MOST_NAVIGATIONS",
  "browser.tabs.openNewTabForMostNavigations",
  true
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "TARGET_TOP_LEVEL_LINK_CLICKS_TO_BLANK",
  "browser.pinebuild.targetTopLevelLinkClicksToBlank",
  false
);

const DEFAULT_WORKSPACE_ID = 0;
const MAX_WORKSPACES_LIMIT = 3;
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
 * A single view in the StageManager. These are intended to be non-mutable.
 */
class View {
  #internalView;

  /**
   * @param {InternalView} internalView
   */
  constructor(internalView) {
    this.#internalView = internalView;
  }

  /** @type {Number} */
  get id() {
    return this.#internalView.id;
  }

  /** @type {string} */
  get url() {
    return this.#internalView.url;
  }

  /** @type {Number} */
  /** The workspaceId matches the userContextId of the tab this view belongs to. **/
  get workspaceId() {
    return this.#internalView.workspaceId;
  }

  /** @type {string} */
  get title() {
    return this.#internalView.title;
  }

  /** @type {string} **/
  /** Returns url of the favicon resource for a view. **/
  get iconURL() {
    return this.#internalView.iconURL;
  }

  /** @type {boolean} **/
  /** Returns a boolean indicating whether this view's browser is in a busy state. **/
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
   * @type {boolean}
   */
  get muted() {
    return this.#internalView.muted;
  }

  /**
   * Returns a boolean indicating whether the view is pinned by the user.
   * @type {boolean}
   */
  get pinned() {
    return this.#internalView.pinned;
  }

  /**
   * Returns a boolean indicating whether the view is loading an article.
   * @type {boolean}
   */
  get isArticle() {
    return this.#internalView.isArticle;
  }

  /** @type {nsIPrincipal} **/
  get contentPrincipal() {
    return this.#internalView.contentPrincipal;
  }
}

/**
 * A ViewGroup is a collection of Views that are related enough that we
 * group them together and represent them as a single unit within the
 * ActiveViewManager. The interface is similar to that of an Array, but
 * its collection is not mutable.
 */
class ViewGroup {
  /** @type {InternalView[]} */
  #views;

  /** @type {boolean} */
  #isApp;

  /**
   * @param {InternalView[]} views
   *   The InternalViews that have been grouped.
   * @param {boolean} [isApp=false]
   *   True if the InternalViews are part of a pinned app.
   */
  constructor(views, isApp = false) {
    this.#views = views;
    this.#isApp = isApp;
  }

  /** @type {View} */
  get lastView() {
    return this.#views.at(-1)?.view;
  }

  /**
   * True if the ViewGroup contains a particular View.
   * @param {View} view
   *   The View to check for the presence of.
   * @returns {boolean}
   **/
  includes(view) {
    let internalView = InternalView.viewMap.get(view);
    return this.#views.includes(internalView);
  }

  /**
   * Returns the View at a particular index within the ViewGroup itself.
   * @param {index} index
   *   The index of the View to retrieve.
   * @returns {View}
   **/
  at(index) {
    return this.#views.at(index)?.view;
  }

  /** @type {Number} */
  get length() {
    return this.#views.length;
  }

  /**
   * Returns the index for a View in the ViewGroup, or -1 if the View is
   * not contained within the ViewGroup.
   * @param {View} view
   *   The View to get the index of.
   * @returns {Number}
   **/
  indexOf(view) {
    let internalView = InternalView.viewMap.get(view);
    return this.#views.indexOf(internalView);
  }

  /** @type {Iterator} */
  [Symbol.iterator]() {
    return this.#views.map(internalView => internalView.view).values();
  }

  get isApp() {
    return this.#isApp;
  }

  /**
   * Determines whether or not two InternalViews should be put into the same
   * ViewGroup.
   *
   * InternalViews can be grouped if they are same origin AND their favicons
   * match (or one of their favicons are null). This heuristic allows
   * us to keep most same-origin navigations grouped, but lets us have
   * group separation for sites that have multiple "apps" hosted under
   * the same origin - for example, docs.google.com is where both
   * Google Docs, Google Spreadsheets and Google Presentatations can be
   * found. However Google makes their favicons distinct, which means
   * we correctly skip grouping them together.
   *
   * @param {InternalView} viewA
   *   The View to check for grouping with viewB
   * @param {InternalView} viewB
   *   The View to check for grouping with viewA
   * @param {Object} options
   *   Extra options that can be optionally passed, including:
   *
   *   {boolean} [pinning=false]
   *     Whether or not the grouping is for a series of pinned views.
   *   {WeakSet} [pinnedAppBrowsers=null]
   *     The set of browsers associated with pinned apps.
   * @returns {boolean} True if the two Views can be grouped.
   */
  static #canGroup(
    viewA,
    viewB,
    win,
    { pinning = false, pinnedAppBrowsers = null } = {}
  ) {
    let isSameOrigin = viewA.contentPrincipal.isSameOrigin(
      viewB.url,
      win.browsingContext.usePrivateBrowsing
    );

    if (pinnedAppBrowsers) {
      let viewABrowser = viewA.getBrowser();
      let viewBBrowser = viewB.getBrowser();
      if (
        viewABrowser === viewBBrowser &&
        pinnedAppBrowsers.has(viewABrowser)
      ) {
        return true;
      }
    }

    // If either of the View icons are null, we'll still let them group
    // if they're same origin. We'll have a chance to reconsider the grouping
    // once the favicon finishes loading.
    return (
      isSameOrigin &&
      (viewA.iconURL == viewB.iconURL ||
        viewA.iconURL == null ||
        viewB.iconURL == null)
    );
  }

  /**
   * Helper function for grouping that scans backwards from the end of a series
   * of InternalViews and generates ViewGroups for them.
   *
   * @param {DOMWindow} window
   *   The browser window that the InternalViews belong to.
   * @param {InternalView[]} views
   *   The collection of InternalViews to group.
   * @param {Object} options
   *   Extra options that can be optionally passed, including:
   *
   *   {Number} [limit=Infinity]
   *     The maximum number of ViewGroups to create. If passed, any InternalViews
   *     that are not put into ViewGroups are returned in the overflowed property
   *     of the return value.
   *   {boolean} [pinning=false]
   *     True if the grouping is for pinned views.
   *   {WeakSet} [pinnedAppBrowsers=null]
   *     The set of browsers associated with pinned apps.
   * @returns {Object}
   *   An object with the following properties:
   *
   *   {ViewGroup[]} groups
   *     The generated ViewGroups
   *   {InternalView[]} overflowed
   *     Leftover InternalViews that were not grouped due to hitting the limit.
   */
  static #groupFromEnd(
    window,
    views,
    { limit = Infinity, pinning = false, pinnedAppBrowsers = null } = {}
  ) {
    let groups = [];
    let overflowed = [];

    if (!views.length) {
      return { groups, overflowed };
    }

    // After the list of Views in the River changes, we want to do some
    // grouping. The idea is to work backwards through the View list, and
    // group Views that are same-origin together into a single ViewGroup.
    // We do this until we reach a maximum of MAX_RIVER_GROUPS, and the
    // rest show up in the overflow menu.

    // We start with the last View in the list, and create a Principal for it
    // to do same-origin checks with other Views. We then add that View to an
    // initial group, and start the loop index at the 2nd last item in the list.
    let lastView = views.at(-1);
    let currentGroup = [lastView];
    let index = views.length - 2;

    // The idea is to work backwards through the list until one of two things
    // happens:
    //
    // 1. We run out of items.
    // 2. The number of groups reaches TOP_RIVER_GROUPS.
    for (; index >= 0; --index) {
      let view = views[index];
      if (
        ViewGroup.#canGroup(currentGroup[0], view, window, {
          pinning,
          pinnedAppBrowsers,
        })
      ) {
        currentGroup.push(view);
        continue;
      } else {
        let isPinnedApp = pinnedAppBrowsers?.has(
          currentGroup.at(-1).getBrowser()
        );
        // We're reversing the currentGroup because we've been _pushing_
        // them into the Array, and we're going to want to ultimately
        // represent them in reverse order. We _could_ have used unshift
        // to put each item at the start of the Array, but that's apparently
        // more expensive than doing one big reverse at the end.
        groups.push(new ViewGroup(currentGroup.reverse(), isPinnedApp));

        if (groups.length >= limit) {
          break;
        }

        currentGroup = [view];
      }
    }

    if (index >= 0) {
      console.assert(
        limit !== Infinity,
        "We got leftover views to group despite having no limit."
      );
      // We bailed out because we reached our maximum number of groups.
      // Any remaining items in the Views from index 0 to index should
      // go into the overflow menu. We also want these to be Views and
      // not InternalViews, so we map them to their .view properties.
      overflowed = [...views.slice(0, index + 1).map(v => v.view)].reverse();
    } else {
      let isPinnedApp = pinnedAppBrowsers?.has(
        currentGroup.at(-1).getBrowser()
      );
      // We bailed out because we reached the end of the list. Whatever is
      // in currentGroup can get pushed into the displayed groups.
      //
      // See the comment inside of the loop for why we're reversing the
      // currentGroup.
      groups.push(new ViewGroup(currentGroup.reverse(), isPinnedApp));
    }

    // Finally, we reverse the displayed ViewGroups that we've collected.
    // Similar to the currentGroup's, this is faster than doing an unshift
    // for each item.
    groups.reverse();

    return { groups, overflowed };
  }

  /**
   * Groups InternalViews into ViewGroups to be represented in the
   * ActiveViewManager.
   *
   * @param {InternalView[]} views
   *   The InternalViews to group.
   * @param {DOMWindow} window
   *   The browser window that the InternalView's belong to.
   * @param {WeakSet} pinnedAppBrowsers
   *     The set of browsers associated with pinned apps.
   * @return {Object}
   *   An object with the following properties:
   *
   *   {ViewGroup[]} groups
   *     The generated ViewGroups for unpinned InternalView's
   *   {InternalView[]} overflowed
   *     Leftover InternalViews that were not grouped due to hitting the limit.
   *   {ViewGroup[]} pinned
   *     The generated ViewGroups for pinned InternalView's.
   */
  static group(views, window, pinnedAppBrowsers) {
    if (!views.length) {
      return { groups: [], overflowed: [], pinned: [] };
    }

    let firstNotPinned = views.findIndex(v => !v.pinned);
    let pinnedViews;
    let unpinnedViews;

    if (firstNotPinned == -1) {
      pinnedViews = views.slice(0);
      unpinnedViews = [];
    } else {
      pinnedViews = views.slice(0, firstNotPinned);
      unpinnedViews = views.slice(firstNotPinned);
    }

    let { groups, overflowed } = ViewGroup.#groupFromEnd(
      window,
      unpinnedViews,
      { limit: MAX_RIVER_GROUPS }
    );
    let { groups: pinned } = ViewGroup.#groupFromEnd(window, pinnedViews, {
      pinning: true,
      pinnedAppBrowsers,
    });

    // For now, as a hack to create a separate "pinned apps" section, we'll sort
    // the viewGroups by app / not-app status, and then set an attribute on the
    // apps so that we can apply a different style for them.
    pinned.sort((a, b) => {
      return Number(a.isApp) - Number(b.isApp);
    });

    return { groups, overflowed, pinned };
  }
}

class InternalView {
  /** @type {Number} **/
  #id;

  /** @type {Number} **/
  #workspaceId;

  /** @type {Number} */
  /** The workspaceId matches the userContextId of the tab this view belongs to. **/
  get workspaceId() {
    return this.#workspaceId;
  }

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

  /** @type {String} **/
  #title;

  /** @type {String} **/
  #userTitle;

  /** @type {boolean} **/
  #submittedPassword;

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
   * @param {Number} workspaceId
   *   ID representing the workspace this view belongs to. We ignore this argument
   *   if browser is not null because that allows us to fetch the userContextId from
   *   the browser'r tab.
   */
  constructor(window, browser, historyEntry, workspaceId) {
    this.#id = InternalView.nextInternalViewID++;
    this.#window = window;
    this.#workspaceId = browser
      ? this.#window.gBrowser.getTabForBrowser(browser).userContextId
      : workspaceId;
    this.#view = new View(this);
    this.#pinned = false;
    this.#contentPrincipal = Services.scriptSecurityManager.createNullPrincipal(
      {}
    );
    this.#creationTime = Cu.now();
    this.#submittedPassword = false;

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
      let originAttributes = E10SUtils.predictOriginAttributes({
        window,
        userContextId: workspaceId,
      });
      this.#contentPrincipal = Services.scriptSecurityManager.createContentPrincipal(
        this.url,
        originAttributes
      );
      this.#title = historyEntry.title;
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
    this.#title = historyEntry.title;
    this.iconURL = browser.mIconURL;
    this.busy = this.#window.gBrowser
      .getTabForBrowser(browser)
      ?.hasAttribute("busy");
    this.securityState = browser.securityUI.state;
    let originAttributes = E10SUtils.predictOriginAttributes({
      window: this.#window,
      userContextId: this.#workspaceId,
    });
    this.#contentPrincipal = Services.scriptSecurityManager.createContentPrincipal(
      this.url,
      originAttributes
    );

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

  setTitle(title) {
    this.#title = title;
  }

  setUserTitle(title) {
    let trimmedTitle = title.trim();
    Snapshots.add({ url: this.url.spec, title: trimmedTitle });
    this.#userTitle = trimmedTitle;
  }

  /**
   * Set to true if a password submission form has been submitted via
   * this View. This is a one-way setting - it's not possible to set this
   * back to false after it has been set to true.
   *
   * @param {boolean} val
   *   True if the user submitted a password form from this view.
   */
  set submittedPassword(val) {
    if (!val) {
      // submittedPassword can only ever be set to true from the initial false state,
      // and not the other way around.
      logConsole.error(
        `Cannot set submittedPassword to false for ${this.toString()}`
      );
      return;
    }
    this.#submittedPassword = val;
  }

  /** @type {boolean} */
  get submittedPassword() {
    return this.#submittedPassword;
  }

  /** @type {Number} */
  get id() {
    return this.#id;
  }

  get title() {
    return this.#userTitle || this.#title;
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

    // If StageManager debugging is enabled, then we want to also update
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
 * An event fired from StageManager to inform about changes
 * to the view stack. Can be one of the following types:
 *
 * `WorkspaceAdded` - A new workspace has been added to the AVM.
 * `ViewChanged` - The current view has changed.
 * `ViewAdded` - A new view has been added to the top of the stack in a workspace.
 * `ViewRemoved` - An existing view has been removed from a workspace.
 * `ViewMoved` - An existing view has been moved to the top of the stack in a workspace.
 * `ViewUpdated` - An existing view has changed in some way.
 * `RiverRebuilt` - The rivers have been replaced with a new state and should be rebuilt.
 * `ViewLoaded` - A view has finished loading.
 */
class StageManagerEvent extends Event {
  #view;
  #detail;

  /**
   * @param {"ViewChanged" | "ViewAdded" | "ViewMoved" | "ViewRemoved" | "ViewUpdated" |
   *   "RiverRebuilt"} type
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
      logConsole.error("Emitting a StageManagerEvent with a non-view", view);
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
   * Optional detail information about the StageManagerEvent.
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
  /** @type {WorkspaceHistory} */
  #workspaceHistory;

  /** @type {Browser} */
  #browser;

  /**
   * @param {WorkspaceHistory} workspaceHistory
   * @param {Browser} browser
   */
  constructor(workspaceHistory, browser) {
    this.#workspaceHistory = workspaceHistory;
    this.#browser = browser;

    this.#browser.addEventListener("pagetitlechanged", this);
    this.#browser.addEventListener("PasswordManager:onFormSubmit", this);
  }

  handleEvent(event) {
    switch (event.type) {
      case "pagetitlechanged": {
        this.#workspaceHistory._onNewTitle(this.#browser);
        break;
      }
      case "PasswordManager:onFormSubmit": {
        this.#workspaceHistory._onPasswordFormSubmit(this.#browser);
        break;
      }
    }
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryNewEntry(newURI, oldIndex) {
    if (!this.#browser.browsingContext) {
      // In some cases we are called after the browser has died.
      return;
    }

    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryNewEntry: ` +
        `${newURI.spec}`
    );

    // Wait for SessionHistory to get updated before proceeding.
    await Promise.resolve();

    this.#workspaceHistory._onBrowserNavigate(this.#browser);
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryReload() {
    if (!this.#browser.browsingContext) {
      // In some cases we are called after the browser has died.
      return;
    }

    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryReload`
    );

    // Wait for SessionHistory to get updated before proceeding.
    await Promise.resolve();
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryGotoIndex() {
    if (!this.#browser.browsingContext) {
      // In some cases we are called after the browser has died.
      return;
    }

    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryGotoIndex`
    );

    // Wait for SessionHistory to get updated before proceeding.
    await Promise.resolve();

    this.#workspaceHistory._onBrowserNavigate(this.#browser);
  }

  /**
   * See nsISHistoryListener
   */
  OnHistoryPurge(numEntries) {
    if (!this.#browser.browsingContext) {
      // In some cases we are called after the browser has died.
      return;
    }

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

    this.#workspaceHistory._onHistoryEntriesRemoved(
      entries.slice(0, numEntries)
    );
  }

  /**
   * See nsISHistoryListener
   */
  OnHistoryTruncate(numEntries) {
    if (!this.#browser.browsingContext) {
      // In some cases we are called after the browser has died.
      return;
    }

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

    this.#workspaceHistory._onHistoryEntriesRemoved(
      entries.slice(entries.length - numEntries)
    );
  }

  /**
   * See nsISHistoryListener
   */
  async OnHistoryReplaceEntry() {
    if (!this.#browser.browsingContext) {
      // In some cases we are called after the browser has died.
      return;
    }

    logConsole.debug(
      `Browser(${this.#browser.browsingContext.id}) - OnHistoryReplaceEntry`
    );
    let { sessionHistory } = this.#browser.browsingContext;
    let previousEntry = sessionHistory.getEntryAtIndex(
      getCurrentIndex(sessionHistory)
    );

    // Wait for SessionHistory to get updated before proceeding.
    await Promise.resolve();

    let newEntry = getCurrentEntry(this.#browser);

    this.#workspaceHistory._onBrowserReplace(
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
 * This class manages a stack of history entries scoped to a specific workspace.
 */
class WorkspaceHistory extends EventTarget {
  /**
   * The window this instance is tracking the history for.
   * @type {DOMWindow}
   */
  #window;

  /** @type {StageManager} */
  #stageManager;

  /**
   * @type {Number}
   */
  #workspaceId = null;

  get workspaceId() {
    return this.#workspaceId;
  }

  /**
   * The stack of views. Most recent is at the end of the list.
   * @type {InternalView[]}
   */
  viewStack = [];

  /**
   * The current ViewGroups for the viewStack for unpinned InternalViews.
   */
  #viewGroups = [];
  /**
   * Overflowed InternalViews that are not currently in any ViewGroups.
   */
  #overflowedViews = [];
  /**
   * The current ViewGroups for the viewStack for pinned InternalViews.
   */
  #pinnedViewGroups = [];

  /**
   * Maintains a reference to the browser listener as long as the browser is alive.
   * @type {WeakMap<Browser, BrowserListener>}
   */
  #browsers = new WeakMap();

  /**
   * A map from session history identifiers to views.
   * @type {Map<number, InternalView>}
   */
  historyViews = new Map();

  /**
   * The set of browsers associated with pinned apps.
   * @type {WeakSet<Browser>}
   */
  pinnedAppBrowsers = new WeakSet();

  constructor(workspaceId, window) {
    super();
    if (!(Number.isInteger(workspaceId) && workspaceId >= 0)) {
      logConsole.error(
        `Could not create workspace history object. Invalid workspace id.`
      );
      return;
    }

    this.#workspaceId = workspaceId;
    this.#window = window;
    this.#stageManager = window.gStageManager;

    for (let tab of this.#window.gBrowser.tabs) {
      if (tab.userContextId !== this.#workspaceId) {
        return;
      }

      this.#watchBrowser(tab.linkedBrowser);
    }
  }

  /**
   * Called by StageManager to handle tab events such as "TabSelect",
   * "TabOpen", "TabClose", "TabAttrModified", "TabBrowserDiscarding" and "SSTabRestoring"
   * for tabs belonging to this workspace.
   *
   * @param {String} type
   *        Event type
   * @param {Tab} tab
   *        Tab object relating to the event
   * @param {String} changedAttr
   *         If event type is "TabAttrChanged", this indicates what's changed.
   */
  handleTabEvent(type, tab, changedAttr = "") {
    if (tab.userContextId != this.#workspaceId) {
      logConsole.error(
        "A tab event was routed to the wrong workspace to handle"
      );
      return;
    }

    let browser = tab.linkedBrowser;
    switch (type) {
      case "TabSelect":
        if (this.#stageManager.windowRestoring) {
          return;
        }

        logConsole.debug(`Browser(${browser.browsingContext.id}) staged.`);
        this._onBrowserNavigate(browser);
        break;
      case "TabOpen":
        if (this.#stageManager.windowRestoring) {
          return;
        }

        if (this.#window.gHistoryCarousel.enabled) {
          this.#window.gHistoryCarousel.showHistoryCarousel(false);
        }

        logConsole.debug(`Browser(${browser.browsingContext.id}) created.`);
        this.#watchBrowser(browser);
        this._onBrowserNavigate(browser);
        break;
      case "TabClose":
        if (this.#stageManager.windowRestoring) {
          return;
        }

        // If we're closing the special OAuth tab, blow away any Views
        // associated with it.
        if (tab.getAttribute("pinebuild-oauth-flow")) {
          let viewsToRemove = this.viewStack.filter(
            view => view.browserId == browser.browserId
          );
          for (let internalView of viewsToRemove) {
            this.#stageManager.closeView(internalView.view);
          }
        }
        break;
      case "TabAttrModified":
        if (this.#stageManager.windowRestoring) {
          return;
        }

        if (changedAttr.includes("image")) {
          this.#onNewIcon(browser);
        } else if (changedAttr.includes("busy")) {
          this.#onBusyChanged(browser, tab.hasAttribute("busy"));
        }
        break;
      case "TabBrowserDiscarding":
        logConsole.debug("Saw a tab discarded");
        TabStateFlusher.flush(browser).then(() => {
          // At this point the browser has already lost its history state so update from session store.
          let state = JSON.parse(SessionStore.getTabState(tab));
          for (let entry of state.entries) {
            let internalView = this.historyViews.get(entry.ID);
            if (internalView) {
              internalView.discard(entry);
            }
          }
        });
        break;
      case "SSTabRestoring":
        logConsole.debug("Saw a tab restored");

        let { sessionHistory } = browser.browsingContext;
        for (let i = 0; i < sessionHistory.count; i++) {
          let entry = sessionHistory.getEntryAtIndex(i);
          let entryId = SessionHistory.getPreviousID(entry) ?? entry.ID;

          let internalView = this.historyViews.get(entryId);
          if (internalView) {
            if (entry.ID != entryId) {
              this.historyViews.delete(entryId);
              this.historyViews.set(entry.ID, internalView);
            }

            internalView.update(browser, entry);
          }
        }

        this.#watchBrowser(browser);
        break;
    }
  }

  /**
   * This function attaches listeners to a browser element
   * that listen to changes to its session history.
   * @param {Browser} browser
   */
  #watchBrowser(browser) {
    if (this.#browsers.has(browser)) {
      logConsole.debug(
        `Browser(${browser.browserId}) does not exist in this workspace`
      );
      return;
    }

    let listener = new BrowserListener(this, browser);
    this.#browsers.set(browser, listener);

    try {
      browser.browsingContext.sessionHistory.addSHistoryListener(listener);
    } catch (e) {
      logConsole.error("Failed to add listener", e);
    }

    if (
      TARGET_TOP_LEVEL_LINK_CLICKS_TO_BLANK &&
      !OPEN_NEW_TAB_FOR_MOST_NAVIGATIONS
    ) {
      browser.browsingContext.targetTopLevelLinkClicksToBlank = true;
    }
  }

  activateView(internalView) {
    if (!this.viewStack.includes(internalView)) {
      logConsole.error(
        `View cannot be activated. It does not exist in this workspace.`
      );
      return;
    }

    let lastIndex = this.viewStack.length - 1;
    if (internalView == this.viewStack[lastIndex]) {
      logConsole.debug(`View is already active`);
      return;
    }

    this.viewStack.splice(this.#stageManager.currentIndex, 1);
    this.viewStack.push(internalView);
  }

  /**
   * Called by StageManager to remove browser listeners.
   */
  clean() {
    let browsers =
      ChromeUtils.nondeterministicGetWeakMapKeys(this.#browsers) || [];
    browsers.forEach(browser => {
      let listener = this.#browsers.get(browser);
      if (listener) {
        try {
          browser.browsingContext?.sessionHistory.removeSHistoryListener(
            listener
          );
        } catch (e) {
          logConsole.error("Failed to remove listener", e);
        }
      }
    });

    this.#browsers = new WeakMap();
  }

  /**
   * Called after the viewStack, or any of its containing InternalViews have
   * been modified. This causes new ViewGroups to be generated for reflection
   * into the ActiveViewManager.
   */
  regroup() {
    // There's a way of doing this destructuring re-assignment in a one-liner,
    // but this is probably more readable.
    let { groups, overflowed, pinned } = ViewGroup.group(
      this.viewStack,
      this.#window,
      this.pinnedAppBrowsers
    );
    this.#viewGroups = groups;
    this.#overflowedViews = overflowed;
    this.#pinnedViewGroups = pinned;
  }

  get viewGroups() {
    return this.#viewGroups;
  }

  get overflowedViews() {
    return this.#overflowedViews;
  }

  get pinnedViewGroups() {
    return this.#pinnedViewGroups;
  }

  /**
   * Called when the document in a browser has changed its favicon.
   * @param {Browser} browser
   *        Underlying browser of a view whose icon was updated by
   *        its publishing website.
   */
  #onNewIcon(browser) {
    let entry = getCurrentEntry(browser);
    if (!entry) {
      return;
    }
    let internalView = this.historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.iconURL = browser.mIconURL;
    this.#stageManager.notifyEvent("ViewUpdated", internalView);
  }

  /**
   * Called when the browser's busy state has changed.
   */
  #onBusyChanged(browser, busy) {
    let entry = getCurrentEntry(browser);
    if (!entry) {
      return;
    }
    let internalView = this.historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.busy = busy;
    this.#stageManager.notifyEvent("ViewUpdated", internalView);
  }

  /**
   * Called when the document in a browser has changed title.
   * @param {Browser} browser
   *    Underlying browser element of a view whose title was updated by
   *    its publishing website.
   */
  _onNewTitle(browser) {
    let entry = getCurrentEntry(browser);
    let internalView = this.historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.setTitle(entry.title);
    this.#stageManager.notifyEvent("ViewUpdated", internalView);
  }

  _onPasswordFormSubmit(browser) {
    let entry = getCurrentEntry(browser);
    let internalView = this.historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    logConsole.debug(
      `Saw password form submission for ${internalView.toString()}`
    );

    internalView.submittedPassword = true;
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
    let previousView = this.historyViews.get(previousEntry.ID);
    if (previousView) {
      logConsole.debug(
        `Found previous InternalView: ${previousView.toString()}`
      );
      this.historyViews.delete(previousEntry.ID);

      let pos = this.viewStack.indexOf(previousView);
      if (pos >= 0) {
        if (this.#window.isInitialPage(newEntry.URI)) {
          logConsole.debug(
            `Previous InternalView was an internal page - discarding.`
          );
          // Don't store initial pages in the river.
          this.viewStack.splice(pos, 1);
          let currentInternalView = InternalView.viewMap.get(
            this.#stageManager.currentView
          );
          if (previousView == currentInternalView) {
            logConsole.trace(`Setting currentInternalView to NULL`);
            let event = new CustomEvent("SetCurrentInternalView", {
              detail: { internalView: null },
            });
            this.dispatchEvent(event);
          }
          this.#stageManager.notifyEvent("ViewRemoved", previousView);

          currentInternalView = InternalView.viewMap.get(
            this.#stageManager.currentView
          );
          if (currentInternalView === null) {
            this.#stageManager.notifyEvent("ViewChanged", null, {
              navigating: true,
              browser,
            });
          }
          return;
        }

        previousView.update(browser, newEntry);
        this.historyViews.set(newEntry.ID, previousView);

        this.#stageManager.notifyEvent("ViewUpdated", previousView);
        this.#stageManager.updateSessionStore();
        return;
      }
      logConsole.error(
        `Could not find InternalView ${previousView.toString()} in ` +
          `the viewStack.`
      );
    }

    // Fallback in the event that the previous entry is not present in the stack.
    logConsole.debug("Falling back to _onBrowserNavigate.");
    this._onBrowserNavigate(browser, newEntry);
  }

  /**
   * Called when a browser loads a view.
   *
   * @param {Browser} browser
   * @param {nsISHEntry} newEntry
   * @param {boolean} viaTabSwitch
   *   True if the "navigation" is actually a tab switch.
   */
  _onBrowserNavigate(
    browser,
    newEntry = getCurrentEntry(browser),
    viaTabSwitch = false
  ) {
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
      logConsole.trace(`Setting #currentInternalView to NULL`);
      let event = new CustomEvent("SetCurrentInternalView", {
        detail: { internalView: null },
      });
      this.dispatchEvent(event);
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
        let preexisting = this.viewStack.find(v => v.historyId == newEntry.ID);
        logConsole.assert(
          !preexisting,
          `Should not find a pre-existing InternalView with SHEntry ID ${newEntry.ID}`
        );
        if (preexisting) {
          logConsole.debug(JSON.parse(JSON.stringify(this.viewStack)));
          logConsole.debug(
            JSON.parse(JSON.stringify([...this.historyViews.entries()]))
          );
        }
      }

      logConsole.debug(`Creating a new InternalView.`);

      // This is a new view.
      internalView = new InternalView(this.#window, browser, newEntry);
      logConsole.trace(
        `Setting #currentInternalView to NEW ${internalView.toString()}`
      );
      let event = new CustomEvent("SetCurrentInternalView", {
        detail: { internalView },
      });
      this.dispatchEvent(event);
      this.#insertNewView(internalView, newEntry, browser);

      SessionManager.register(this.#window, internalView.url).catch(
        logConsole.error
      );

      this.#stageManager.notifyEvent("ViewAdded", internalView);
    } else {
      logConsole.debug(`Updating InternalView ${internalView.toString()}.`);
      // This is a navigation to an existing view.
      internalView.update(browser, newEntry, {
        resetCreationTime: overwriting,
      });

      let currentInternalView = InternalView.viewMap.get(
        this.#stageManager.currentView
      );
      if (internalView == currentInternalView) {
        logConsole.trace(`Updated InternalView is the current index.`);
        logConsole.groupEnd();
        this.#stageManager.notifyEvent("ViewUpdated", internalView);
        return;
      }

      logConsole.trace(
        `Setting #currentInternalView to EXISTING ${internalView.toString()}`
      );
      let event = new CustomEvent("SetCurrentInternalView", {
        detail: { internalView },
      });
      this.dispatchEvent(event);
      let pos = this.viewStack.indexOf(internalView);
      if (pos < 0) {
        logConsole.warn("Navigated to a view not in the existing stack.");
        this.viewStack.push(internalView);

        this.#stageManager.notifyEvent("ViewAdded", internalView);
      }
    }

    this.#stageManager.startActivationTimer();
    this.#stageManager.updateSessionStore();
    this.#stageManager.notifyEvent("ViewChanged", internalView, {
      navigating: !viaTabSwitch,
      browser,
    });

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
    let internalView = this.historyViews.get(newEntry.ID);
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
      internalView = this.historyViews.get(previousID);
      if (internalView) {
        logConsole.debug(`Found InternalView ${internalView.toString()}`);
        this.historyViews.delete(previousID);
        this.historyViews.set(newEntry.ID, internalView);
        return { internalView, overwriting: false };
      }
    }

    if (this.#stageManager.pendingView?.url.spec == newEntry.URI.spec) {
      logConsole.debug(
        `Found pending View ${this.#stageManager.pendingView.toString()}.`
      );
      internalView = InternalView.viewMap.get(this.#stageManager.pendingView);
      this.historyViews.delete(internalView.historyId);
      this.historyViews.set(newEntry.ID, internalView);
      let event = new CustomEvent("ClearPendingInternalView");
      this.dispatchEvent(event);
      return { internalView, overwriting: false };
    }

    if (INTERSTITIAL_VIEW_OVERWRITING || LOGIN_VIEW_OVERWRITING) {
      let makeOverwritingObject = (previousView, overwritingEntry) => {
        this.historyViews.delete(previousView.historyId);
        this.historyViews.set(overwritingEntry.ID, previousView);
        return { internalView: previousView, overwriting: true };
      };

      let newEntryHistoryIndex = getHistoryIndex(browser, newEntry.ID);
      let previousEntryHistoryIndex = newEntryHistoryIndex - 1;

      if (previousEntryHistoryIndex >= 0) {
        let { sessionHistory, currentWindowGlobal } = browser.browsingContext;
        let previousEntry = sessionHistory.getEntryAtIndex(
          previousEntryHistoryIndex
        );
        if (previousEntry) {
          let previousView = this.historyViews.get(previousEntry.ID);
          if (previousView) {
            if (INTERSTITIAL_VIEW_OVERWRITING) {
              // For quick navigations (for example, bounces through an OAuth
              // provider), we want to avoid creating extra InternalViews
              // unnecessarily, as the user is unlikely to want to return to
              // them. We check to see if the previous InternalView for this
              // browser is considered a quick navigation, and if so, we return
              // that for overwriting.
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
                return makeOverwritingObject(previousView, newEntry);
              }
            }
            if (LOGIN_VIEW_OVERWRITING && previousView.submittedPassword) {
              // For navigations away from pages where the user has submitted a
              // password through a form, we'll assume that the user has gone through
              // some kind of login flow and overwrite that view, since it's unlikely
              // the user will want to go back to the login page (or that the login
              // page will let them login again without first logging out).
              logConsole.debug(
                `Overwriting InternalView ${previousView.toString()} due to the ` +
                  `previous view having submitted a password form`
              );
              return makeOverwritingObject(previousView, newEntry);
            }
          }
        }
      }
    }

    return { internalView: null, overwriting: false };
  }

  /**
   * Takes a newly constructed View and finds the most appropriate place
   * in the viewStack to insert it into.
   *
   * Regarding the arguments, while it's true that both the newEntry and
   * browser could be inferred by newInternalView, the caller of this function
   * is known to already have those values available, and this saves us having
   * to do another set of lookups.
   *
   * @param {InternalView} newInternalView
   *   The new View being added
   * @param {nsISHEntry} newEntry
   *   The nsISHEntry associated with the new View
   * @param {Browser} browser
   *   The browser associated with the View
   */
  #insertNewView(newInternalView, newEntry, browser) {
    if (this.pinnedAppBrowsers.has(browser)) {
      let siblingViewIndex = -1;
      for (let i = 0; i < this.viewStack.length; ++i) {
        let internalView = this.viewStack[i];
        if (internalView.getBrowser() == browser) {
          siblingViewIndex = i;
        } else if (siblingViewIndex >= 0) {
          break;
        }
      }
      console.assert(
        siblingViewIndex >= 0,
        "pinnedAppBrowsers and viewStack are still in sync"
      );
      newInternalView.pinned = true;
      // We don't need to do a bounds check here with siblingViewIndex, because
      // splice will just insert at the end of the Array if siblingViewIndex + 1
      // goes past the end.
      this.viewStack.splice(siblingViewIndex + 1, 0, newInternalView);
    } else {
      this.viewStack.push(newInternalView);
    }
    this.historyViews.set(newEntry.ID, newInternalView);
  }

  /**
   * @param {object[]} entries The serialized entries that were removed.
   */
  _onHistoryEntriesRemoved(entries) {
    for (let entry of entries) {
      let internalView = this.historyViews.get(entry.ID);
      if (internalView) {
        internalView.drop(entry);
      }
    }

    this.#stageManager.updateSessionStore();
  }

  /**
   * @type {number} The number of pinned Views in this workspace.
   */
  getPinnedViewCount() {
    let index;
    for (index = 0; index < this.viewStack.length; index++) {
      if (!this.viewStack[index].pinned) {
        break;
      }
    }
    return index;
  }

  /**
   * Sets the `pinned` state on a View to shouldPin in this Workspace.
   *
   * @param {InternalView} view The View to set the pinned state on.
   * @param {boolean} shouldPin True if the View should be pinned.
   * @param {boolean} appMode True if the View should be pinned in App Mode.
   * @param {Number | null} index The index within the Pinned Views section
   *   of the #viewStack to put the Pinned View. Defaults to 0.
   */
  setInternalViewPinnedState(internalView, shouldPin, appMode, index = 0) {
    let pinnedViewCount = this.getPinnedViewCount();
    if (index > pinnedViewCount) {
      throw new Error(
        "Cannot pin at an index greater than the number of pinned Views"
      );
    }

    let browser = internalView.getBrowser();
    let isBulkJob = appMode || this.pinnedAppBrowsers.has(browser);

    if (isBulkJob) {
      // Find every other InternalView associated with the pinned view's
      // browser, and (presuming they can be grouped together) pin them
      // all sequentially.
      let [views, remains] = this.viewStack.reduce(
        (result, someView) => {
          if (someView.getBrowser() == browser) {
            result[0].push(someView);
          } else {
            result[1].push(someView);
          }
          return result;
        },
        [[], []]
      );

      if (shouldPin) {
        this.viewStack = remains;
        // Now inject the newly pinned views at the end of the pinned section
        // of the views array...
        this.viewStack.splice(pinnedViewCount, 0, ...views);
        this.pinnedAppBrowsers.add(browser);
      } else {
        this.viewStack = remains;
        // Now inject the newly pinned views at the end of the pinned section
        // of the views array...
        this.viewStack.push(...views);
        this.pinnedAppBrowsers.delete(browser);
      }

      for (let view of views) {
        view.pinned = shouldPin;
        if (shouldPin) {
          Snapshots.add({
            url: view.url.spec,
            userPersisted: Snapshots.USER_PERSISTED.PINNED,
          });
        }
      }
    } else {
      // We don't want to remove Pinned Views from the viewStack Array,
      // since so much of StageManager relies on all available Views
      // existing in it.
      //
      // To accommodate Pinned Views, we borrow the organizational model
      // of Pinned Tabs from tabbrowser: Views that are pinned are moved
      // to the beginning of the viewStack Array. So if we started with
      // this viewStack:
      //
      // [Unpinned View 1, Unpinned View 2, Unpinned View 3]
      //
      // and then pinned View 3, viewStack would become:
      //
      // [Pinned View 3, Unpinned View 1, Unpinned View 2]
      //
      // This way, we can keep pinned Views within #viewStack and not have
      // to treat them specially throughout StageManager.
      let viewIndex = this.viewStack.indexOf(internalView);
      this.viewStack.splice(viewIndex, 1);

      if (shouldPin) {
        this.viewStack.splice(index, 0, internalView);
        Snapshots.add({
          url: internalView.url.spec,
          userPersisted: Snapshots.USER_PERSISTED.PINNED,
        });
      } else {
        this.viewStack.push(internalView);
      }
    }

    internalView.pinned = shouldPin;
    this.#stageManager.notifyEvent("ViewUpdated", internalView);
    this.#stageManager.notifyEvent("ViewChanged", internalView);
  }

  /**
   * Returns whether or not an InternalView is a Pinned View (as opposed)
   * to being unpinned, or a Pinned App.
   *
   * @param {InternalView | null} internalView
   *   The InternalView (or null) to check. null always returns false.
   * @returns {boolean}
   */
  isPinnedView(internalView) {
    if (!internalView) {
      return false;
    }
    return (
      internalView.pinned &&
      !this.pinnedAppBrowsers.has(internalView.getBrowser())
    );
  }
}

/**
 * This class manages several workspaces scoped to a specific window.
 *
 * Can emit the following events:
 * `WorkspaceAdded` - A new workspace has been added to the AVM.
 * `ViewChanged` - The current view has changed.
 * `ViewAdded` - A new view has been added to the top of the stack in a workspace.
 * `ViewRemoved` - An existing view has been removed from a workspace.
 * `ViewMoved` - An existing view has been moved to the top of the stack in a workspace.
 * `ViewUpdated` - An existing view has changed in some way.
 * `RiverRebuilt` - The rivers have been replaced with a new state and should be rebuilt.
 * `ViewLoaded` - A view has finished loading.
 */
class StageManager extends EventTarget {
  /**
   * The window this instance is managing workspaces for.
   * @type {DOMWindow}
   */
  #window;

  /**
   * A map from workspaceIds to WorkspaceHistory objects.
   */
  #workspaces = new Map();

  /**
   * Currently staged view's internal view object.
   * @type {InternalView | null}
   */
  #currentInternalView = null;

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
   * @type {View}
   */
  get pendingView() {
    return this.#pendingView?.view;
  }

  /**
   * True if the window is currently being restored from a saved session.
   */
  #windowRestoring = false;

  /**
   * @type {boolean}
   */
  get windowRestoring() {
    return this.#windowRestoring;
  }

  /**
   * True if our most recent navigation was forward in the StageManager.
   */
  #navigatingForward = false;

  /**
   * True if the history carousel is currently visible in the window.
   */
  #historyCarouselMode = false;

  /**
   * True if we're in the midst of transitioning in or out of the history
   * carousel.
   */
  #historyCarouselTransitioning = false;

  /**
   * While in history carousel mode, this member tracks which InternalView
   * the user currently has selected. This is mainly used to power the back
   * button while in the history carousel mode.
   */
  #currentHistoryCarouselInternalView = null;

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
  }

  /**
   * Called once the DOM is ready, and we know that gBrowser is available.
   */
  init() {
    // Create a workspace history object for the default workspace.
    this.#createWorkspaceHistory(DEFAULT_WORKSPACE_ID);
    this.#window.gBrowser.tabContainer.addEventListener("TabSelect", this);
    this.#window.gBrowser.tabContainer.addEventListener("TabOpen", this);
    this.#window.gBrowser.tabContainer.addEventListener("TabClose", this);
    this.#window.gBrowser.tabContainer.addEventListener(
      "TabAttrModified",
      this
    );
    this.#window.gBrowser.tabContainer.addEventListener(
      "TabBrowserDiscarding",
      this
    );
    this.#window.gBrowser.tabContainer.addEventListener("SSTabRestoring", this);

    this.#window.addEventListener("SSWindowRestoring", () =>
      this.#sessionRestoreStarted()
    );

    this.#window.addEventListener("HistoryCarousel:Ready", event =>
      this.#historyCarouselReady()
    );

    this.#window.addEventListener("HistoryCarousel:TransitionStart", event =>
      this.#setHistoryCarouselTransitioning(true)
    );

    this.#window.addEventListener("HistoryCarousel:TransitionEnd", event =>
      this.#setHistoryCarouselTransitioning(false)
    );

    this.#window.addEventListener("HistoryCarousel:Exit", event =>
      this.#historyCarouselExit(event.detail)
    );

    this.#window.gBrowser.addTabsProgressListener(this);
  }

  handleEvent(event) {
    let workspace;
    switch (event.type) {
      case "TabSelect":
      case "TabOpen":
      case "TabClose":
      case "TabAttrModified":
      case "TabBrowserDiscarding":
        let tab = event.target;
        workspace = this.#workspaces.get(tab.userContextId);
        if (!workspace) {
          logConsole.error("Tab is not associated with a workspace.");
          return;
        }
        workspace.handleTabEvent(
          event.type,
          event.target,
          event.detail?.changed
        );
        break;
      case "SSTabRestoring":
        let wId = event.target.userContextId;
        workspace = this.#workspaces.get(wId);
        if (!workspace) {
          this.#createWorkspaceHistory(wId);
          return;
        }
        workspace.handleTabEvent(
          event.type,
          event.target,
          event.detail?.changed
        );
        break;
      case "SetCurrentInternalView":
        let internalView = event.detail.internalView;
        if (internalView === null || internalView instanceof InternalView) {
          this.#currentInternalView = internalView;
        } else {
          logConsole.error(
            "Tried setting an invalid value into #currentInternalView"
          );
        }
        break;
      case "ClearPendingInternalView":
        this.#pendingView = null;
        break;
    }
  }

  #createWorkspaceHistory(workspaceId) {
    let workspaceHistory = new WorkspaceHistory(workspaceId, this.#window);
    this.#workspaces.set(workspaceId, workspaceHistory);
    workspaceHistory.addEventListener("SetCurrentInternalView", this);
    workspaceHistory.addEventListener("ClearPendingInternalView", this);
  }

  createWorkspace() {
    for (
      let workspaceId = DEFAULT_WORKSPACE_ID + 1;
      workspaceId < MAX_WORKSPACES_LIMIT;
      workspaceId++
    ) {
      if (!this.#workspaces.has(workspaceId)) {
        this.#createWorkspaceHistory(workspaceId);
        this.loadEmptyWorkspace(workspaceId);

        // Deselect any previously selected view.
        this.#currentInternalView = null;

        this.notifyEvent("WorkspaceAdded", null, { workspaceId });
        break;
      }
    }

    let workspacesButton = this.#window.document.getElementById(
      "appMenu-start-new-workspace-button"
    );
    workspacesButton.disabled = this.#workspaces.size == MAX_WORKSPACES_LIMIT;
  }

  onSecurityChange(browser, webProgress, request, status) {
    let entry = getCurrentEntry(browser);
    if (!entry) {
      return;
    }

    let tab = this.#window.gBrowser.getTabForBrowser(browser);
    let workspaceId = tab.userContextId;
    let workspace = this.#workspaces.get(workspaceId);
    let internalView = workspace.historyViews.get(entry.ID);
    if (!internalView) {
      return;
    }

    internalView.update(browser, entry);
    this.notifyEvent("ViewUpdated", internalView);
  }

  onStateChange(browser, webProgress, request, stateFlags, status) {
    if (
      stateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW &&
      stateFlags & Ci.nsIWebProgressListener.STATE_STOP
    ) {
      let entry = getCurrentEntry(browser);
      if (!entry) {
        return;
      }

      let tab = this.#window.gBrowser.getTabForBrowser(browser);
      let workspaceId = tab.userContextId;
      let workspace = this.#workspaces.get(workspaceId);
      let internalView = workspace.historyViews.get(entry.ID);
      if (!internalView) {
        return;
      }

      internalView.update(browser, entry);
      this.notifyEvent("ViewLoaded", internalView);
    }
  }

  /**
   * Clears all the current tabs, and ensures the history is blank. Will create
   * an initial tab and returns a promise that resolves when that tab completes
   * loading.
   *
   * @param {object} [options]
   * @param {string} [options.url]
   *   An optional url to load default tab content.
   * @param {boolean} [options.skipPermitUnload]
   *   Set to true if it is ok to skip the before unload handlers when closing
   *   tabs (e.g. tabbrowser.runBeforeUnloadForTabs() has been called).
   *  @returns {Promise} Resolves when the default tab has finished loading.
   */
  reset({
    url = this.#window.BROWSER_NEW_TAB_URL,
    skipPermitUnload = false,
  } = {}) {
    let newTab = this.#window.gBrowser.addTrustedTab(url);
    let loadPromise = new Promise(resolve => {
      let listener = {
        onStateChange(webProgress, request, stateFlags, status) {
          let targetState =
            Ci.nsIWebProgressListener.STATE_IS_NETWORK +
            Ci.nsIWebProgressListener.STATE_IS_WINDOW +
            Ci.nsIWebProgressListener.STATE_STOP;

          if (stateFlags == targetState && request.originalURI.spec == url) {
            newTab.linkedBrowser.removeProgressListener(listener);
            resolve();
          }
        },

        QueryInterface: ChromeUtils.generateQI([
          Ci.nsIWebProgressListener,
          Ci.nsISupportsWeakReference,
        ]),
      };

      newTab.linkedBrowser.addProgressListener(listener);
    });

    this.#window.gBrowser.selectedTab = newTab;
    this.#window.gBrowser.removeAllTabsBut(newTab, {
      animate: false,
      skipPermitUnload,
    });
    for (let workspace of this.#workspaces.values()) {
      workspace.historyViews.clear();
      workspace.viewStack = [];
      workspace.regroup();
    }
    logConsole.trace(`Setting #currentInternalView to NULL`);
    this.#currentInternalView = null;
    this.notifyEvent("RiverRebuilt");
    return loadPromise;
  }

  /**
   * Dispatches a StageManagerEvent of type "type" on this.
   *
   * @param {String} type The type of StageManagerEvent to dispatch.
   * @param {InternalView} internalView The InternalView associated with the
   *   event. Note that the associated View will be attached to the event, and
   *   not the InternalView.
   * @param {Object | null} detail Optional detail information to include with
   *   the event.
   */
  notifyEvent(type, internalView, detail) {
    if (internalView) {
      let workspace = this.#workspaces.get(internalView.workspaceId);
      workspace.regroup();
    }

    this.dispatchEvent(new StageManagerEvent(type, internalView?.view, detail));
  }

  #sessionRestoreStarted() {
    logConsole.debug("Session restore started.");

    // Window is starting restoration, stop listening to everything.
    this.#windowRestoring = true;

    if (this.#activationTimer) {
      this.clearActivationTimer();
    }

    for (let workspace of this.#workspaces.values()) {
      workspace.clean();
    }

    this.#window.addEventListener(
      "SSWindowRestored",
      () => {
        this.#sessionRestoreEnded();
      },
      { once: true }
    );
  }

  #sessionRestoreEnded() {
    logConsole.debug("Session restore ended.");
    // Session restore is done, rebuild everything from the new state.
    this.#windowRestoring = false;

    let stateStr = SessionStore.getCustomWindowValue(
      this.#window,
      SESSIONSTORE_STATE_KEY
    );

    for (let workspace of this.#workspaces.values()) {
      workspace.historyViews.clear();
      workspace.viewStack = [];
    }

    // Tabs are not yet functional so build a set of views from cached history state.
    let state = [];
    if (stateStr) {
      try {
        state = JSON.parse(stateStr);
      } catch (e) {
        logConsole.warn("Failed to deserialize StageManager state.", e);
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
    for (let { id, cachedEntry, workspaceId } of state) {
      if (cachedEntry) {
        // For older sessions, we might not have a workspace ID, so fallback
        // to the default.
        workspaceId = workspaceId ?? DEFAULT_WORKSPACE_ID;

        let internalView = new InternalView(
          this.#window,
          null,
          cachedEntry,
          workspaceId
        );
        this.#workspaces.get(workspaceId).historyViews.set(id, internalView);
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
      let userContextId = tab.userContextId;
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
            this.#workspaces
              .get(userContextId)
              .historyViews.set(entry.ID, internalView);
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
            this.#workspaces
              .get(userContextId)
              .historyViews.set(entry.ID, internalView);
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
    for (let { id, workspaceId } of state) {
      // For older sessions, we might not have a workspace ID, so fallback
      // to the default.
      workspaceId = workspaceId ?? DEFAULT_WORKSPACE_ID;
      let internalView = previousIdMap.get(id);
      if (!internalView) {
        logConsole.warn("Missing history entry for river entry.");
        continue;
      }

      this.#workspaces.get(workspaceId).viewStack.push(internalView);
    }

    let selectedBrowser = this.#window.gBrowser.selectedBrowser;
    let selectedEntry = getCurrentEntry(selectedBrowser);
    let selectedWorkspaceId = this.#window.gBrowser.selectedTab.userContextId;
    let selectedWorkspace = this.#workspaces.get(selectedWorkspaceId);
    let selectedView = selectedWorkspace.historyViews.get(selectedEntry.ID);

    if (!selectedView) {
      logConsole.warn("Selected entry was not in state.");
      selectedView = new InternalView(
        this.#window,
        selectedBrowser,
        selectedEntry,
        selectedWorkspaceId
      );
      selectedWorkspace.historyViews.set(selectedEntry.ID, selectedView);
      selectedWorkspace.viewStack.push(selectedView);
    }

    logConsole.trace(
      `Setting #currentInternalView to ${selectedView.toString()}`
    );
    this.#currentInternalView = selectedView;

    for (let workspace of this.#workspaces.values()) {
      workspace.regroup();
    }

    this.notifyEvent("RiverRebuilt");
    this.startActivationTimer();
    this.updateSessionStore();
  }

  updateSessionStore() {
    // Stash the view order into session store.
    let state = [];
    for (let workspace of this.#workspaces.values()) {
      for (let internalView of workspace.viewStack) {
        state.push({
          id: internalView.historyId,
          cachedEntry: internalView.cachedEntry,
          workspaceId: internalView.workspaceId,
        });
      }
    }

    SessionStore.setCustomWindowValue(
      this.#window,
      SESSIONSTORE_STATE_KEY,
      JSON.stringify(state)
    );
  }

  /**
   * Called when a user changes a page's title.
   * @param {View} view
   *        View whose page title was updated by the user.
   * @param {String} userTitle
   *        Contains updated title provided by the user.
   */
  setUserTitle(view, userTitle) {
    let internalView = InternalView.viewMap.get(view);
    if (!internalView) {
      return;
    }

    internalView.setUserTitle(userTitle);
    this.notifyEvent("ViewUpdated", internalView);
  }

  /**
   * This function clears the activation timer that moves views
   * to the top of the river. We may want to clear the timer when
   * the page action menu is opened, for example, to avoid promoting
   * views to the top and disconnecting them from the menu.
   */
  clearActivationTimer() {
    this.#window.clearTimeout(this.#activationTimer);
  }

  /**
   * This function starts a timer to move a view in the river to
   * the top position.
   */
  startActivationTimer() {
    if (this.#activationTimer) {
      this.clearActivationTimer();
    }

    let timeout = StageManager.activationTimeout;
    if (timeout == 0) {
      return;
    }

    logConsole.debug(`Starting activation timer.`);
    this.#activationTimer = this.#window.setTimeout(() => {
      this.activateCurrentView();
    }, timeout);
  }

  /**
   * This function moves the current/staged view to the top of the river.
   */
  activateCurrentView() {
    logConsole.debug(`Activating current InternalView.`);
    this.#activationTimer = null;

    if (this.#historyCarouselMode) {
      logConsole.debug(`Not activating views since we're in mega back mode`);
      return;
    }

    if (!this.#currentInternalView) {
      logConsole.debug(`We don't have a view to activate`);
      return;
    }

    if (this.#currentInternalView.pinned) {
      logConsole.debug(`Cannot activate a pinned view.`);
      return;
    }

    this.currentWorkspace.activateView(this.#currentInternalView);
    this.notifyEvent("ViewMoved", this.#currentInternalView);
    this.updateSessionStore();
    logConsole.debug(
      `Activated InternalView ${this.#currentInternalView.toString()}`
    );
  }

  /**
   * Returns a snapshot of currently visible views in the window. If in
   * history carousel mode, it returns a snapshot of views from the currently
   * selected workspace only.
   * @type {View[]}
   */
  get views() {
    let views = [];
    if (this.#historyCarouselMode) {
      views.push(...this.currentWorkspace.viewStack);
    } else {
      for (let workspace of this.#workspaces.values()) {
        views.push(...workspace.viewStack);
      }
    }
    return views.map(internalView => internalView.view);
  }

  /**
   * Returns a snapshot of the current stack of InternalViews. This is
   * an encapsulation violation and only returns a non-null value when
   * running with browser.companion.stagemanagerdebugging set to `true`.
   *
   * Do not use this for production code.
   *
   * @type {InternalView[]}
   */
  get internalViewsDebuggingOnly() {
    if (!DEBUG) {
      return null;
    }

    let views = [];
    for (let workspace of this.#workspaces.values()) {
      views.push(...workspace.viewStack);
    }
    return views;
  }

  /**
   * Returns currently staged view.
   * @type {View | null}
   */
  get currentView() {
    return (
      this.#currentHistoryCarouselInternalView?.view ||
      this.#currentInternalView?.view ||
      null
    );
  }

  /**
   * NOTE: This getter does not return the current workspace's workspaceHistory
   * object if its viewStack is empty i.e. if there are no "non-initial" views
   * present in it.
   * @type {WorkspaceHistory | null}
   */
  get currentWorkspace() {
    let currentWorkspaceId = this.currentView?.workspaceId;
    return this.#workspaces.get(currentWorkspaceId) || null;
  }

  /**
   * Returns currently staged view's index in
   * its workspace history stack.
   * @type {Number}
   */
  get currentIndex() {
    return this.currentWorkspace.viewStack.indexOf(this.#currentInternalView);
  }

  /**
   * This function returns the current workspace's Id if there are no currentViews
   * that we can use to determine the currentWorkspace.
   */
  #getEmptyCurrentWorkspaceId() {
    let urlbar = this.#window.document.getElementById("urlbar");
    return parseInt(urlbar.getAttribute("workspace-id"));
  }

  /**
   * NOTE: If we don't have a currentView to help us determine
   * the currentWorkspace, it either means that we don't have any
   * workspaces open in the AVM or that we do have workspaces
   * with only initial pages as views.
   */
  #getCurrentWorkspaceId() {
    return (
      this.currentWorkspace?.workspaceId ?? this.#getEmptyCurrentWorkspaceId()
    );
  }

  /**
   * Opens about:blank in a given empty workspace.
   * @params {Number} workspaceId
   */
  loadEmptyWorkspace(workspaceId) {
    this.#window.gBrowser.selectedTab = this.#window.gBrowser.addTrustedTab(
      "about:blank",
      { userContextId: workspaceId }
    );
  }

  /**
   * Returns the WorkspaceHistory with a particular ID, or null
   * if no such WorkspaceHistory can be found for the window.
   *
   * @param {Number} workspaceId
   *   The ID of the WorkspaceHistory to retrieve.
   * @returns {WorkspaceHistory | null}
   */
  getWorkspaceWithId(workspaceId) {
    return this.#workspaces.get(workspaceId);
  }

  /**
   * Helper function that takes a ViewGroup and, depending
   * on the contents of the ViewGroup, returns a View that should
   * be acted upon by default. Non-pinned app ViewGroups will result
   * in the last View in the group returned. Pinned app ViewGroups
   * will return the View associated with the current history entry
   * in the underlying browser element.
   *
   * @param {ViewGroup} viewGroup
   *   The ViewGroup to get the representative View from.
   * @returns {View}
   */
  #getViewInGroup(viewGroup) {
    let view = viewGroup.lastView;
    if (!viewGroup.isApp) {
      return view;
    }

    let internalView = InternalView.viewMap.get(view);
    let browser = internalView.getBrowser();
    let SHEntry = getCurrentEntry(browser);
    let workspace = this.#workspaces.get(internalView.workspaceId);
    let currentInternalViewForBrowser = workspace.historyViews.get(SHEntry.ID);
    return currentInternalViewForBrowser.view;
  }

  /**
   * Stages a View from a ViewGroup.
   *
   * @param {ViewGroup} viewGroup
   *   The ViewGroup to stage a View from.
   */
  setViewInGroup(viewGroup) {
    let view = this.#getViewInGroup(viewGroup);
    this.setView(view);
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

    let workspace = this.#workspaces.get(internalView.workspaceId);
    let pos = workspace.viewStack.indexOf(internalView);
    if (pos == -1) {
      throw new Error("Unknown View.");
    }

    let browser = internalView.getBrowser();

    // If we're showing the history carousel, then we don't actually want
    // to change the staged View - but we do want to update the AVM with the
    // selection.
    if (this.#historyCarouselMode) {
      // The user might choose this view shortly, so we pre-emptively
      // "warm it up" to send its DisplayList down to the compositor,
      // to improve perceived performance when switching to it.
      let gBrowser = this.#window.gBrowser;
      let tab = gBrowser.getTabForBrowser(browser);
      gBrowser.warmupTab(tab);

      this.#currentHistoryCarouselInternalView = internalView;
      this.notifyEvent("ViewChanged", internalView, {
        navigating: false,
        browser,
      });

      if (internalView.pinned) {
        // Currently, pinned views are not shown in the carousel, so
        // if we select one in the AVM while showing the carousel,
        // we avoid user confusion by then immediately exiting the
        // carousel.
        this.#window.gHistoryCarousel.showHistoryCarousel(false);
      }

      return;
    }

    let currentWorkspaceId = this.#getCurrentWorkspaceId();
    if (internalView.workspaceId > currentWorkspaceId) {
      this.#navigatingForward = true;
    } else if (internalView.workspaceId == currentWorkspaceId) {
      if (internalView.pinned == this.#currentInternalView?.pinned) {
        this.#navigatingForward = pos > this.currentIndex;
      } else {
        this.#navigatingForward = internalView.pinned;
      }
    } else {
      this.#navigatingForward = false;
    }

    if (this.#currentInternalView == internalView) {
      logConsole.debug("View is already the current view.");
      return;
    }

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
                `index ${historyIndex}, ID ${internalView.historyId}.`
            );
            let sh = browser.browsingContext.sessionHistory;
            logConsole.debug(
              `INDEX: ${sh.index}, REQUESTED INDEX: ${sh.requestedIndex}`
            );
            browser.gotoIndex(historyIndex);
          } else {
            logConsole.debug(
              `NOT navigating browser ${browser.browsingContext.id} to SHistory ` +
                `index ${historyIndex}, ID ${internalView.historyId} - it's already there!`
            );
          }

          // Tab switch if necessary.
          if (this.#window.gBrowser.selectedBrowser !== browser) {
            logConsole.debug(
              `Putting browser ${browser.browsingContext.id} on the stage.`
            );
            let tab = this.#window.gBrowser.getTabForBrowser(browser);
            this.#window.gBrowser.selectedTab = tab;
            // If we're bringing a browser into the foreground, we'll make
            // sure it's then allowed to continue playing media once its
            // backgrounded again.
            browser.suspendMediaWhenInactive = false;
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
   * @param {boolean} appMode True if the View is being pinned as an app.
   * @param {Number | null} index The index within the Pinned Views section
   *   of the viewStack to put the Pinned View. Defaults to 0.
   */
  setViewPinnedState(view, shouldPin, appMode, index = 0) {
    let internalView = InternalView.viewMap.get(view);
    if (!internalView) {
      throw new Error("Unknown view.");
    }

    logConsole.log("Pinning view ", internalView.toString());

    let workspace = this.#workspaces.get(internalView.workspaceId);
    workspace.setInternalViewPinnedState(
      internalView,
      shouldPin,
      appMode,
      index
    );
  }

  /**
   * Whether it is possible to navigate back in the workspace history.
   * @type {boolean}
   */
  get canGoBack() {
    if (this.#historyCarouselTransitioning) {
      return false;
    }

    let currentView = this.#historyCarouselMode
      ? this.#currentHistoryCarouselInternalView
      : this.#currentInternalView;

    let currentIndex =
      this.currentWorkspace?.viewStack.indexOf(currentView) || null;
    let prevView = this.currentWorkspace?.viewStack[currentIndex - 1];
    return currentIndex > 0 && !this.currentWorkspace?.isPinnedView(prevView);
  }

  /**
   * Whether it is possible to navigate forwards in the workspace history.
   * @type {boolean}
   */
  get canGoForward() {
    if (this.#historyCarouselTransitioning) {
      return false;
    }

    let currentView = this.#historyCarouselMode
      ? this.#currentHistoryCarouselInternalView
      : this.#currentInternalView;

    let currentIndex =
      this.currentWorkspace?.viewStack.indexOf(currentView) || null;
    return currentIndex < this.currentWorkspace?.viewStack.length - 1;
  }

  /**
   * Navigates back in the workspace history. Returns true if navigation began.
   * @returns {boolean}
   */
  goBack() {
    if (!this.canGoBack) {
      return false;
    }

    let currentView = this.#historyCarouselMode
      ? this.#currentHistoryCarouselInternalView
      : this.#currentInternalView;

    let currentIndex = this.currentWorkspace.viewStack.indexOf(currentView);
    this.setView(this.currentWorkspace.viewStack[currentIndex - 1].view);
    return true;
  }

  /**
   * Navigates forward in the workspace history. Returns true if navigation began.
   * @returns {boolean}
   */
  goForward() {
    if (!this.canGoForward) {
      return false;
    }

    let currentView = this.#historyCarouselMode
      ? this.#currentHistoryCarouselInternalView
      : this.#currentInternalView;

    let currentIndex = this.currentWorkspace.viewStack.indexOf(currentView);
    this.setView(this.currentWorkspace.viewStack[currentIndex + 1].view);
    return true;
  }

  /**
   * True if the most recent navigation was forward in the StageManager.
   * @returns {bool}
   */
  get navigatingForward() {
    return !!this.#navigatingForward;
  }

  /**
   * Closes the currently selected view.
   */
  closeCurrentView() {
    let currentView = this.#historyCarouselMode
      ? this.#currentHistoryCarouselInternalView
      : this.#currentInternalView;
    this.#closeInternalView(currentView);
  }

  /**
   * Closes a View from a ViewGroup.
   *
   * @param {ViewGroup} viewGroup
   *   The ViewGroup to close a View in.
   */
  closeViewInGroup(viewGroup) {
    let view = this.#getViewInGroup(viewGroup);
    this.closeView(view);
  }

  /**
   * Public method for removing a View from StageManager.
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
   * Removes the passed in InternalView from the corresponding workspace's viewStack,
   * cleans up any leftover resources from the InternalView, and then fires the
   * ViewRemoved event so that the UI can update the visualization of Views.
   *
   * @param {InternalView} internalView The InternalView to close.
   */
  #closeInternalView(internalView) {
    let workspace = this.#workspaces.get(internalView.workspaceId);
    let index = workspace.viewStack.indexOf(internalView);
    if (index == -1) {
      throw new Error("Could not find the View in the #viewStack");
    }

    // First, attempt to switch to the next View
    let viewToSwitchTo = workspace.viewStack[index + 1];

    // If no such View exists, then go to the previous View instead.
    if (!viewToSwitchTo) {
      viewToSwitchTo = workspace.viewStack[index - 1];
    }

    // If the View we're closing is pinned, and the View that
    // we've selected to switch to isn't pinned, then we must
    // have run out of pinned Views. In that case, just switch
    // to the last View in the River.
    if (internalView.pinned && viewToSwitchTo && !viewToSwitchTo.pinned) {
      viewToSwitchTo = workspace.viewStack[workspace.viewStack.length - 1];
    }

    // If none of the above was possible, we conclude that we're closing
    // the last View in this workspace, so attempt switching to the default workspace.
    if (
      !viewToSwitchTo &&
      this.currentWorkspace.workspaceId != DEFAULT_WORKSPACE_ID
    ) {
      let defaultWorkspace = this.#workspaces.get(DEFAULT_WORKSPACE_ID);
      let lastIndex = defaultWorkspace.viewStack.size - 1;
      viewToSwitchTo = defaultWorkspace.viewStack[lastIndex];
    }

    let browser = internalView.getBrowser();

    // If none of the above was possible, we conclude that we're closing
    // the last View in this workspace, so do a reset.
    if (!viewToSwitchTo) {
      // Load a new tab to signal a clean workspace.
      this.loadEmptyWorkspace(internalView.workspaceId);

      // Close the deleted view's tab in the workspace.
      let tab = this.#window.gBrowser.getTabForBrowser(browser);
      if (!tab.closing) {
        this.#window.gBrowser.removeTab(tab, { animate: false });
      }

      // Clear old workspace state.
      workspace.viewStack = [];
      workspace.historyViews.clear();

      this.notifyEvent("ViewRemoved", internalView);
      return;
    }

    this.setView(viewToSwitchTo.view);

    if (browser) {
      // Check to see if the view we're closing is the last one for the
      // associated <browser>. In that case, we can get rid of that
      // <browser> - but only if we weren't already closing it.
      if (
        workspace.viewStack.every((view, i) => {
          return (
            view.getBrowser() != browser ||
            (view.getBrowser() == browser && index == i)
          );
        })
      ) {
        let tab = this.#window.gBrowser.getTabForBrowser(browser);
        if (!tab.closing) {
          this.#window.gBrowser.removeTab(tab, { animate: false });
        }
      } else {
        // Work our way back through the history of the browser we're
        // about to close the View for and try to find another View.
        // If we find one, pre-emptively navigate the underlying <browser>
        // to that one, and put it into the "block autoplay" state so that
        // any autoplaying media requires the user to select the background
        // view before playing.
        let historyIndex = getHistoryIndex(browser, internalView.historyId);
        console.assert(
          historyIndex > 0,
          "The sessionHistory count has gone out of sync."
        );
        for (let i = historyIndex - 1; i >= 0; --i) {
          let previousEntry = browser.browsingContext.sessionHistory.getEntryAtIndex(
            i
          );
          let previousView = workspace.historyViews.get(previousEntry.ID);
          if (previousView && viewToSwitchTo.getBrowser() != browser) {
            // We're navigating a browser in the background. We don't want to
            // surprise the user with autoplaying media, so we'll suspend the
            // media until the page is foregrounded again.
            browser.suspendMediaWhenInactive = true;
            browser.gotoIndex(i);
            break;
          }
        }
      }
    }

    workspace.viewStack.splice(index, 1);
    workspace.historyViews.delete(internalView.historyId);
    this.notifyEvent("ViewRemoved", internalView);
  }

  /**
   * Puts the window into, or takes it out of, the history carousel transition
   * state.
   *
   * @param {boolean} isTransitioning
   *   True if the transition is starting to occur, false if it has ended.
   */
  #setHistoryCarouselTransitioning(isTransitioning) {
    this.#historyCarouselTransitioning = isTransitioning;
    this.#window.UpdateBackForwardCommands(this);
  }

  #historyCarouselReady() {
    this.#window.gBrowser.tabbox.setAttribute(
      "disable-history-animations",
      "true"
    );
    this.#historyCarouselMode = true;
    this.#currentHistoryCarouselInternalView = this.#currentInternalView;
  }

  async #historyCarouselExit({ finalIndex }) {
    logConsole.debug(
      "Exiting history carousel mode, selecting index ",
      finalIndex
    );
    this.#historyCarouselMode = false;
    this.#currentHistoryCarouselInternalView = null;
    let internalView = this.currentWorkspace.viewStack[finalIndex];
    logConsole.debug(`Selecting view: ${internalView.toString()}`);
    this.setView(internalView.view);

    let flushed = this.#window.promiseDocumentFlushed(() => {});
    // Finally, we'll wait until we've completed the next paint and composite
    // on the whole window before re-enabling history animations.
    let lastTransactionId = this.#window.windowUtils.lastTransactionId;
    let painted = new Promise(resolve => {
      let listener = event => {
        if (event.transactionId > lastTransactionId) {
          this.#window.removeEventListener("MozAfterPaint", listener);
          resolve();
        }
      };
      this.#window.addEventListener("MozAfterPaint", listener);
    });

    await Promise.all([flushed, painted]);

    this.#window.gBrowser.tabbox.removeAttribute("disable-history-animations");
    this.notifyEvent("ExitedHistoryCarousel");
  }

  /**
   * @typedef {object} WireframeData
   *   An object that contains enough information to generate a low-fidelity
   *   visual representation of a webpage.
   * @property {Wireframe} wireframe
   *   A wireframe collected from a document. See Document.webidl for the
   *   full structure.
   * @property {number} width
   *   The width of the content area at the time of wireframe capture.
   * @property {number} height
   *   The height of the content area at the time of wireframe capture.
   */

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
   * @property {Blob|WireframeData} image
   *   A visual representation of the view - either a Blob image, or a
   *   wireframe.
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
   * other View in the currently selected workspace.
   *
   * @returns {Promise}
   * @resolves {InitialHistoryCarouselData}
   *   Resolves once the state has been entered (or if we're already in the
   *   selected state).
   */
  async getInitialHistoryCarouselData() {
    let data = {
      currentIndex: this.currentIndex,
      previews: [],
    };

    for (
      let index = this.currentWorkspace.getPinnedViewCount();
      index < this.currentWorkspace.viewStack.length;
      ++index
    ) {
      let internalView = this.currentWorkspace.viewStack[index];
      let preview = {
        index,
        viewID: internalView.id,
        title: internalView.title,
        url: internalView.url.spec,
        iconURL: internalView.iconURL,
        image: null,
      };

      if (index == this.currentIndex) {
        await this.#window.promiseDocumentFlushed(() => {});
        let currentBrowser = this.#currentInternalView.getBrowser();
        preview.image = await PageThumbs.captureToBlob(currentBrowser, {
          fullScale: true,
          fullViewport: true,
        });
      }

      data.previews.push(preview);
    }

    return data;
  }

  /**
   * Returns a Promise that resolves with HistoryCarouselData for a View at
   * a particular View in the viewStack.
   *
   * @param {Number} index
   *   The index of the View to get the HistoryCarouselData for.
   * @returns {Promise}
   * @resolves {InitialHistoryCarouselData|null}
   *   Resolves once the viewport screenshot has been captured. Resolves
   *   with null if the View is not currently loaded in memory.
   */
  async getHistoryCarouselDataForIndex(index) {
    let internalView = this.currentWorkspace.viewStack[index];
    let result = {
      viewID: internalView.id,
      title: internalView.title,
      url: internalView.url.spec,
      iconURL: internalView.iconURL,
      image: null,
    };

    let browser = internalView.getBrowser();

    if (internalView.state == "open") {
      let blob = await PageThumbs.captureToBlob(browser, {
        fullScale: true,
        fullViewport: true,
      });
      result.image = { blob };
    } else {
      let browserBox = this.#window.document.getElementById("browser");
      let rect = this.#window.windowUtils.getBoundsWithoutFlushing(browserBox);
      let wireframe = null;
      if (browser && browser.browsingContext) {
        let historyIndex = getHistoryIndex(browser, internalView.historyId);
        let historyEntry = browser.browsingContext.sessionHistory.getEntryAtIndex(
          historyIndex
        );
        wireframe = historyEntry.wireframe;
      } else if (internalView.cachedEntry) {
        wireframe = internalView.cachedEntry.wireframe;
      }

      result.image = {
        wireframe,
        width: rect.width,
        height: rect.height,
      };
    }

    return result;
  }
}

XPCOMUtils.defineLazyPreferenceGetter(
  StageManager,
  "activationTimeout",
  "browser.river.activationTimeout",
  30000
);
