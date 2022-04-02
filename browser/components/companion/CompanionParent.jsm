/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["CompanionParent"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  clearTimeout: "resource://gre/modules/Timer.jsm",
  InteractionsBlocklist: "resource:///modules/InteractionsBlocklist.jsm",
  OAuth2: "resource:///modules/OAuth2.jsm",
  OnlineServices: "resource:///modules/OnlineServices.jsm",
  PageDataSchema: "resource:///modules/pagedata/PageDataSchema.jsm",
  PageDataService: "resource:///modules/pagedata/PageDataService.jsm",
  PlacesUtils: "resource://gre/modules/PlacesUtils.jsm",
  requestIdleCallback: "resource://gre/modules/Timer.jsm",
  SessionManager: "resource:///modules/SessionManager.jsm",
  SnapshotGroups: "resource:///modules/SnapshotGroups.jsm",
  Services: "resource://gre/modules/Services.jsm",
  setTimeout: "resource://gre/modules/Timer.jsm",
  Snapshots: "resource:///modules/Snapshots.jsm",
  SnapshotSelector: "resource:///modules/SnapshotSelector.jsm",
});

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "selectByType",
  "browser.companion.snapshots.selectByType",
  false
);
const workshopEnabled = Services.prefs.getBoolPref(
  "browser.pinebuild.workshop.enabled",
  false
);

const PLACES_CACHE_EVICT_AFTER = 60 * 6 * 1000; // 6 minutes
// Give ourselves a little bit of a buffer when calling setTimeout to evict
// things from the places cache, otherwise we might end up scheduling
// setTimeouts more often than we would like.
const PLACES_EVICTION_TIMEOUT = PLACES_CACHE_EVICT_AFTER * 1.5;
const PREFERRED_SNAPSHOT_FAVICON_WIDTH_PX = 16;

// Defines pages that we force to show a certain snapshot type. The regular
// expresions are applied to the entire url.
const DOMAIN_TYPES = {
  [PageDataSchema.DATA_TYPE.PRODUCT]: [
    /^https:\/\/www\.walmart\.com\//,
    /^https:\/\/www\.target\.com\//,

    // Too liberal really.
    /^https:\/\/(smile|www)\.amazon\./,
  ],
};

// We need this to be a global so that we only record this for the first
// window created. There's also an identical check in telemetry-helpers in the
// child.
let gTimestampsRecorded = new Set();

class CompanionParent extends JSWindowActorParent {
  constructor() {
    super();
    this._browserIdsToTabs = new Map();
    this._cachedFaviconURLs = new Map();
    this._cachedFavicons = [];
    this._cachedPlacesTitles = new Map();
    this._pageType = null;
    // Used to stop async events occuring after destruction.
    this._destroyed = true;

    this._observer = this.observe.bind(this);
    this._handleTabEvent = this.handleTabEvent.bind(this);
    this._handleStageManagerEvent = this.handleStageManagerEvent.bind(this);
    this._pageDataFound = this.pageDataFound.bind(this);
    this._handleSessionUpdate = this.handleSessionUpdate.bind(this);
    this._setupStageManagerPrefObservers = this.setUpStageManagerDebuggingObservers.bind(
      this
    );

    this._cacheCleanupTimeout = null;
    this._cleanupCaches = this.cleanupCaches.bind(this);

    Services.obs.addObserver(
      this._observer,
      "browser-window-tracker-add-window"
    );
    Services.obs.addObserver(
      this._observer,
      "browser-window-tracker-remove-window"
    );
    Services.obs.addObserver(
      this._observer,
      "browser-window-tracker-tab-added"
    );
    Services.obs.addObserver(
      this._observer,
      "browser-window-tracker-tab-removed"
    );

    Services.obs.addObserver(this._observer, "companion-signin");
    Services.obs.addObserver(this._observer, "companion-signout");
    Services.obs.addObserver(this._observer, "companion-services-refresh");
    Services.obs.addObserver(this._observer, "companion-submenu-change");
    Services.obs.addObserver(this._observer, "oauth-refresh-token-received");
    Services.obs.addObserver(this._observer, "oauth-access-token-received");
    Services.obs.addObserver(this._observer, "oauth-access-token-error");
    Services.obs.addObserver(this._observer, "places-snapshot-group-added");
    Services.obs.addObserver(this._observer, "places-snapshot-group-updated");
    Services.obs.addObserver(this._observer, "places-snapshot-group-deleted");

    Services.prefs.addObserver(
      "browser.companion.stagemanagerdebugging",
      this._setupStageManagerPrefObservers
    );

    for (let win of BrowserWindowTracker.orderedWindows) {
      for (let tab of win.gBrowser.tabs) {
        this.registerTab(tab);
      }

      this.registerWindow(win);
    }
  }

  actorCreated() {
    this.setUpStageManagerDebuggingObservers();
    this._destroyed = false;
    SessionManager.on("session-replaced", this._handleSessionUpdate);
    SessionManager.on("session-set-aside", this._handleSessionUpdate);
    SessionManager.on("sessions-updated", this._handleSessionUpdate);
    // Initialise the display of the last session UI.
    this.retrieveAndSendSessionData();
    this.sessionSetAside();
  }

  setUpStageManagerDebuggingObservers() {
    if (Services.prefs.getBoolPref("browser.companion.stagemanagerdebugging")) {
      let hist = this.browsingContext.topChromeWindow.gStageManager;
      for (let event of [
        "ViewChanged",
        "ViewAdded",
        "ViewRemoved",
        "ViewUpdated",
        "ViewMoved",
      ]) {
        hist.addEventListener(event, this._handleStageManagerEvent);
      }
    } else {
      this.removeStageManagerDebuggingObservers();
    }
  }

  removeStageManagerDebuggingObservers() {
    if (!this.browsingContext.topChromeWindow) {
      return;
    }
    let hist = this.browsingContext.topChromeWindow.gStageManager;
    for (let event of [
      "ViewChanged",
      "ViewAdded",
      "ViewRemoved",
      "ViewUpdated",
      "ViewMoved",
    ]) {
      hist.removeEventListener(event, this._handleStageManagerEvent);
    }
  }

  didDestroy() {
    this._destroyed = true;

    if (this._cacheCleanupTimeout) {
      clearTimeout(this._cacheCleanupTimeout);
      this._cacheCleanupTimeout = null;
    }
    Services.obs.removeObserver(
      this._observer,
      "browser-window-tracker-add-window"
    );
    Services.obs.removeObserver(
      this._observer,
      "browser-window-tracker-remove-window"
    );
    Services.obs.removeObserver(
      this._observer,
      "browser-window-tracker-tab-added"
    );
    Services.obs.removeObserver(
      this._observer,
      "browser-window-tracker-tab-removed"
    );

    Services.obs.removeObserver(this._observer, "companion-signin");
    Services.obs.removeObserver(this._observer, "companion-signout");
    Services.obs.removeObserver(this._observer, "companion-services-refresh");
    Services.obs.removeObserver(this._observer, "companion-submenu-change");
    Services.obs.removeObserver(this._observer, "oauth-refresh-token-received");
    Services.obs.removeObserver(this._observer, "oauth-access-token-received");
    Services.obs.removeObserver(this._observer, "oauth-access-token-error");
    Services.obs.removeObserver(this._observer, "places-snapshot-group-added");
    Services.obs.removeObserver(
      this._observer,
      "places-snapshot-group-updated"
    );
    Services.obs.removeObserver(
      this._observer,
      "places-snapshot-group-deleted"
    );

    Services.prefs.removeObserver(
      "browser.companion.stagemanagerdebugging",
      this._setupStageManagerPrefObservers
    );

    this.removeStageManagerDebuggingObservers();

    for (let win of BrowserWindowTracker.orderedWindows) {
      for (let tab of win.gBrowser.tabs) {
        this.unregisterTab(tab);
      }

      this.unregisterWindow(win);
    }

    if (this.snapshotSelector) {
      this.snapshotSelector.destroy();
      PageDataService.off("page-data", this._pageDataFound);
      this.snapshotSelector = null;
    }
    SessionManager.off("session-replaced", this._handleSessionUpdate);
    SessionManager.off("session-set-aside", this._handleSessionUpdate);
    SessionManager.off("sessions-updated", this._handleSessionUpdate);

    this._browserIdsToTabs.clear();
  }

  ensureCacheCleanupRunning() {
    if (!this._cacheCleanupTimeout) {
      this._cacheCleanupTimeout = setTimeout(
        this._cleanupCaches,
        PLACES_EVICTION_TIMEOUT
      );
    }
  }

  cleanupCaches() {
    // This isn't very expensive, but we do want to make sure that A) we're not
    // doing this during critical work, and B) we're not running if there's
    // nothing even in the cache. This lets us prevent waking up the thread
    // intermittently when we would otherwise just be able to sleep.
    requestIdleCallback(() => {
      let nextExpiration = null;
      let now = Date.now();
      try {
        let entries = [...this._cachedFaviconURLs.entries()];
        let evictions = [];
        for (let [url, expires] of entries) {
          if (expires <= now) {
            evictions.push(url);
            this._cachedFaviconURLs.delete(url);
          } else if (!nextExpiration || expires < nextExpiration) {
            nextExpiration = expires;
          }
        }
        this.sendAsyncMessage("Companion:EvictFavicons", evictions);
      } finally {
        // Even in the event of a weird error we don't break this loop:
        // Either we schedule cleanup again to run at the next expiration, or
        // we clear out _cacheCleanupTimeout so that cleanup can be scheduled
        // the next time something is added to the cache.
        if (nextExpiration) {
          this._cacheCleanupTimeout = setTimeout(
            this._cleanupCaches,
            nextExpiration - now
          );
        } else {
          this._cacheCleanupTimeout = null;
        }
      }
    });
  }

  getMediaData(tab) {
    let controller = tab.linkedBrowser?.browsingContext?.mediaController;
    if (!controller) {
      return null;
    }
    let metadata = null;
    try {
      metadata = controller.getMetadata();
    } catch (e) {
      // The tab has no associated media data.
      return {};
    }

    return {
      metadata,
      supportedKeys: controller.supportedKeys,
      isPlaying: controller.isPlaying,
    };
  }

  getTabData(tab) {
    let tabBrowser = tab.linkedBrowser;
    // TODO: this getActor call will create the actor for every tab. If it
    // doesn't exist, we don't want to create it. I think we need to add a
    // hasActor method for this, as getExistingActor crashes (I don't think it's
    // meant for that). See MR2-1636.
    let pipToggleParent = tabBrowser?.browsingContext?.currentWindowGlobal?.getActor(
      "PictureInPictureToggle"
    );

    return {
      browserId: tabBrowser?.browserId,
      media: this.getMediaData(tab),
      audioMuted: tabBrowser?.audioMuted,
      title: tabBrowser?.contentTitle,
      canTogglePip: !!pipToggleParent?.trackingMouseOverVideos,
      soundPlaying: tab.soundPlaying,
    };
  }

  unregisterTab(tab) {
    if (tab.linkedBrowser) {
      this._browserIdsToTabs.delete(tab.linkedBrowser.browserId);
    }

    tab.removeEventListener("TabPipToggleChanged", this._handleTabEvent);
  }

  registerTab(tab) {
    if (tab.linkedBrowser) {
      this._browserIdsToTabs.set(tab.linkedBrowser.browserId, tab);
    }

    tab.addEventListener("TabPipToggleChanged", this._handleTabEvent);
  }

  registerWindow(win) {
    let tabs = win.gBrowser.tabContainer;
    tabs.addEventListener("TabAttrModified", this._handleTabEvent);
  }

  unregisterWindow(win) {
    let tabs = win.gBrowser.tabContainer;
    tabs.removeEventListener("TabAttrModified", this._handleTabEvent);
  }

  async getFavicon(page, width) {
    let service = Cc["@mozilla.org/browser/favicon-service;1"].getService(
      Ci.nsIFaviconService
    );
    return new Promise(resolve => {
      service.getFaviconDataForPage(
        Services.io.newURI(page),
        (uri, dataLength, data, mimeType) => {
          resolve({
            url: page,
            data: dataLength ? data : null,
            mimeType,
          });
        },
        width
      );
    });
  }

  /**
   * Retrieves sessions from the SessionManager
   *
   * @returns {Session[]}
   */
  async getSessionData() {
    if (this._destroyed) {
      return null;
    }
    let browser = this.browsingContext.top.embedderElement;
    if (!browser) {
      // The browser element has gone away, so skip the rest.
      return null;
    }
    let results = await SessionManager.query({ includePages: true });
    results = results.filter(session => session.pages.length);

    if (results) {
      let urls = results
        .map(result => result.pages.map(page => page.url))
        .flat();
      let icons = await this.getFavicons(urls);
      for (const result of results) {
        for (const page of result.pages) {
          page.favicon = icons.find(icon => icon.url.includes(page.url));
        }
      }

      // If the child has already been closed, then bail out early to avoid
      // errors thrown in tests.
      if (this._destroyed) {
        return null;
      }
      return results;
    }
    return null;
  }

  /**
   * Retrieves and sends session data from the SessionManager
   *
   */
  async retrieveAndSendSessionData() {
    let results = await this.getSessionData();
    if (results != null) {
      this.sendAsyncMessage("Companion:SessionUpdated", results);
    }
  }

  async getSnapshotGroups() {
    let groups = await SnapshotGroups.query({ includeMetadata: true });

    // TODO: filed https://mozilla-hub.atlassian.net/browse/MR2-1869 to remove when
    // dependency is fulfilled.
    for (let group of groups) {
      let firstResult = await SnapshotGroups.getSnapshots({
        id: group.id,
        count: 1,
      });
      group.url = firstResult[0].url;
      group.image = firstResult[0].image;
    }
    this.sendAsyncMessage("Companion:SnapshotGroupsData", groups);
  }

  async getSnapshotGroupData(message) {
    let result = await SnapshotGroups.getSnapshots({ id: message.data.id });
    this.sendAsyncMessage("Companion:SnapshotGroupsDetails", result);
  }

  getFavicons(pages) {
    if (this._destroyed) {
      return [];
    }
    let browser = this?.browsingContext?.top?.embedderElement;
    if (!browser) {
      // The browser element has gone away, so just continue.
      return [];
    }
    let width = this.#getFaviconWidth(browser);
    return Promise.all(pages.map(page => this.getFavicon(page, width)));
  }

  #getFaviconWidth(browser) {
    return (
      PREFERRED_SNAPSHOT_FAVICON_WIDTH_PX *
      Math.ceil(browser.ownerGlobal.devicePixelRatio)
    );
  }

  async getEventLinkTitles(urls) {
    let resultMap = new Map();
    try {
      for (let url of urls) {
        let cached = this._cachedPlacesTitles.get(url);
        if (cached) {
          resultMap.set(url, cached);
        }
      }

      let filtered = urls.filter(u => !resultMap.has(u));
      if (!filtered.length) {
        return resultMap;
      }
      let pages = await PlacesUtils.history.fetchMany(filtered);
      for (let page of pages.values()) {
        this._cachedPlacesTitles.set(page.url.href, page.title);
        resultMap.set(page.url.href, page.title);
      }
      return resultMap;
    } finally {
      // Pull out the keys into an array since we'll be deleting from the map
      // as we go.
      let keys = [...Object.keys(this._cachedPlacesTitles)];
      for (let url of keys) {
        // If it wasn't referenced this time around, just remove it. Because of
        // the way getting events works, if we stop requesting a URL we probably
        // don't need it anymore.
        if (!resultMap.has(url)) {
          this._cachedPlacesTitles.delete(url);
        }
      }
    }
  }

  async ensureFaviconsCached(urls) {
    let uncachedUrls = urls.filter(u => !this._cachedFaviconURLs.has(u));
    let favicons = await this.getFavicons(uncachedUrls);
    this._cachedFavicons.push(...favicons);

    let evictionTime = Date.now() + PLACES_CACHE_EVICT_AFTER;
    for (let url of urls) {
      this._cachedFaviconURLs.set(url, evictionTime);
    }
    this.ensureCacheCleanupRunning();
  }

  consumeCachedFaviconsToSend() {
    let result = this._cachedFavicons;
    this._cachedFavicons = [];
    return result;
  }

  async populateAdditionalEventData(events) {
    let linkUrls = events.flatMap(e =>
      e.links.filter(l => !!l.url).map(l => l.url)
    );
    // Calendar events can have links associated with them, like links to
    // a shared document for a meeting. We want to have the option of
    // populating the link's text in the meeting UI with the title of the
    // page, assuming it's in the user's history.
    let [linkTitles] = await Promise.all([
      this.getEventLinkTitles(linkUrls),
      this.ensureFaviconsCached(linkUrls),
    ]);
    for (let event of events) {
      for (let link of event.links) {
        link.title = linkTitles.get(link.url);
      }
    }
  }

  async getEvents() {
    // _onSubscribe still calls this method, so stop that from doing anything
    // when workshop is enabled.
    if (workshopEnabled) {
      return [];
    }
    let events = OnlineServices.getEventsFromCache();
    await this.populateAdditionalEventData(events);
    return events;
  }

  async observe(subj, topic, data) {
    switch (topic) {
      case "browser-window-tracker-add-window": {
        this.registerWindow(subj);
        for (let tab of subj.gBrowser.tabs) {
          this.registerTab(tab);
          this.sendAsyncMessage(
            "Companion:TabAddedOrUpdated",
            this.getTabData(tab)
          );
        }
        break;
      }
      case "browser-window-tracker-remove-window": {
        this.unregisterWindow(subj);
        for (let tab of subj.gBrowser.tabs) {
          this.unregisterTab(tab);
          this.sendAsyncMessage("Companion:TabRemoved", this.getTabData(tab));
        }
        break;
      }
      case "browser-window-tracker-tab-added": {
        this.registerTab(subj);
        this.sendAsyncMessage(
          "Companion:TabAddedOrUpdated",
          this.getTabData(subj)
        );
        break;
      }
      case "browser-window-tracker-tab-removed": {
        this.unregisterTab(subj);
        this.sendAsyncMessage("Companion:TabRemoved", this.getTabData(subj));
        break;
      }
      case "companion-signin":
      case "companion-signout":
        if (topic == "companion-signin") {
          this.sendAsyncMessage("Companion:SignIn", {
            service: data,
            connectedServices: workshopEnabled
              ? null
              : OnlineServices.connectedServiceTypes,
          });
        } else if (topic == "companion-signout") {
          this.sendAsyncMessage("Companion:SignOut", {
            service: data,
            connectedServices: workshopEnabled
              ? null
              : OnlineServices.connectedServiceTypes,
          });
        }
        break;
      case "companion-services-refresh":
        let events = subj.wrappedJSObject;
        await this.populateAdditionalEventData(events);
        this.sendAsyncMessage("Companion:RegisterCalendarEvents", {
          events,
          newFavicons: this.consumeCachedFaviconsToSend(),
        });
        break;
      case "companion-submenu-change": {
        this.sendAsyncMessage("Companion:BrowsePanel");
        break;
      }
      case "oauth-refresh-token-received":
        this.sendAsyncMessage("Companion:OAuthRefreshTokenReceived", {
          service: data,
        });
        break;
      case "oauth-access-token-error":
        this.sendAsyncMessage("Companion:OAuthAccessTokenError", {
          service: data,
        });
        break;
      case "places-snapshot-group-added":
      case "places-snapshot-group-updated":
      case "places-snapshot-group-deleted":
        this.sendAsyncMessage("Companion:SnapshotGroupsChanged", {
          topic,
          service: data,
        });
        break;
    }
  }

  viewTab(tab) {
    this.sendAsyncMessage("Companion:ViewTab", { tab });
  }

  handleStageManagerEvent(event) {
    let stageManager = this.maybeGetStageManager();
    this.sendAsyncMessage("Companion:StageManagerEvent", {
      stageManager,
    });
  }

  handleTabEvent(event) {
    switch (event.type) {
      case "TabAttrModified":
      case "TabPipToggleChanged": {
        this.sendAsyncMessage(
          "Companion:TabAddedOrUpdated",
          this.getTabData(event.target)
        );
        break;
      }
    }
  }

  handleSessionUpdate(eventName, window, guid) {
    switch (eventName) {
      case "session-set-aside":
        if (window == this.browsingContext.topChromeWindow) {
          this.sessionSetAside();
        }
      // Intentional fallthrough: eslint-disable-next-line no-fallthrough
      case "session-replaced":
        this.retrieveAndSendSessionData();
        this.viewTab("now");
        break;
      case "sessions-updated": {
        this.retrieveAndSendSessionData();
        break;
      }
    }
  }

  sessionSetAside() {
    this.viewTab("now");
    this.sendAsyncMessage("Companion:ResetFlowEntered");
    let win = this.browsingContext.topChromeWindow;
    win.document.body.setAttribute("flow-reset", true);

    const listener = {
      QueryInterface: ChromeUtils.generateQI(["nsIWebProgressListener"]),

      onLocationChange(aWebProgress, aRequest, aLocationURI, aFlags) {
        // Wait for the first location change away from the about:flow-reset page,
        // loading about:flow-reset includes load events for about:blank and there
        // is no problem with being in flow reset state over about:blank.
        let ignored = ["about:flow-reset", "about:blank"];
        if (!aWebProgress.isTopLevel || ignored.includes(aLocationURI.spec)) {
          return;
        }
        win.document.body.removeAttribute("flow-reset");
        this.sendAsyncMessage("Companion:ResetFlowExited");
        win.gBrowser.removeProgressListener(listener);
      },
    };
    listener.onLocationChange = listener.onLocationChange.bind(this);
    win.gBrowser.addProgressListener(listener);
  }

  validateCompanionPref(name) {
    let result =
      name.startsWith("companion") || name.startsWith("browser.companion");
    if (!result) {
      Cu.reportError(
        "Prefs set through Companion messages must be prefixed by 'companion'"
      );
    }
    return result;
  }

  maybeGetStageManager() {
    if (
      !Services.prefs.getBoolPref(
        "browser.companion.stagemanagerdebugging",
        false
      )
    ) {
      return null;
    }

    let {
      internalViewsDebuggingOnly,
      currentView,
    } = this.browsingContext.topChromeWindow.gStageManager;
    return internalViewsDebuggingOnly.map((v, i) => ({
      title: v.title,
      urlSpec: v.url.spec,
      state: v.state,
      isCurrent: v.view === currentView,
      index: i,
      historyState: v.historyState,
      workspaceId: v.workspaceId,
    }));
  }

  pageDataFound(event, pageData) {
    let { gBrowser } = this.browsingContext.top.embedderElement.ownerGlobal;
    let type = Object.keys(pageData.data)[0];
    if (
      selectByType &&
      !this._pageType &&
      this.snapshotSelector &&
      pageData.url == gBrowser.currentURI.spec
    ) {
      this.snapshotSelector.setType(type);
    }
  }

  async receiveMessage(message) {
    switch (message.name) {
      case "Companion:Subscribe": {
        await this._onSubscribe();
        break;
      }
      case "Companion:MuteAllTabs": {
        this._onMuteAllTabs();
        break;
      }
      case "Companion:MediaControl": {
        this._onMediaControl(message);
        break;
      }
      case "Companion:PauseAllMedia": {
        this._onPauseAllMedia();
        break;
      }
      case "Companion:FocusTab": {
        this._onFocusTab(message);
        break;
      }
      case "Companion:LaunchPip": {
        this._onLaunchPip(message);
        break;
      }
      case "Companion:OpenURL": {
        this._onOpenURL(message);
        break;
      }
      case "Companion:DeleteSnapshot": {
        await this._onDeleteSnapshot(message);
        break;
      }
      case "Companion:FetchSnapshotGroups": {
        this.getSnapshotGroups().catch(console.error);
        break;
      }
      case "Companion:FetchSnapshotGroupDetails": {
        this.getSnapshotGroupData(message).catch(console.error);
        break;
      }
      case "Companion:RestoreSession": {
        this._onRestoreSession(message);
        break;
      }
      case "Companion:setCharPref": {
        this._onSetCharPref(message);
        break;
      }
      case "Companion:setBoolPref": {
        this._onSetBoolPref(message);
        break;
      }
      case "Companion:setIntPref": {
        this._onSetIntPref(message);
        break;
      }
      case "Companion:SetStageManagerViewIndex": {
        this._onSetStageManagerViewIndex(message);
        break;
      }
      case "Companion:GetDocumentTitle": {
        return this._onGetDocumentTitle(message);
      }
      case "Companion:ConnectService": {
        this._onConnectService(message);
        break;
      }
      case "Companion:GetOAuth2Tokens": {
        return this._onGetOAuth2Tokens(message);
      }
      case "Companion:AccountCreated": {
        this._onAccountCreated(message);
        break;
      }
      case "Companion:AccountDeleted": {
        this._onAccountDeleted(message);
        break;
      }
      case "Companion:Open": {
        this._onOpen();
        break;
      }
      case "Companion:IsActiveWindow": {
        return this._onIsActiveWindow();
      }
      case "Companion:SuggestedSnapshotsPainted": {
        this._onSuggestedSnapshotsPainted(message);
        break;
      }
      case "Companion:CalendarPainted": {
        this._onCalendarPainted(message);
        break;
      }
    }
    return null;
  }

  /**
   * Updates the snapshot URL and type for focused snapshots.
   * @param {nsIWebProgress} aWebProgress
   *   The nsIWebProgress instance that fired the notification.
   * @param {nsIRequest} aRequest
   *   The associated nsIRequest.  This may be null in some cases.
   * @param {nsIURI} aLocationURI
   *   The URI of the location that is being loaded.
   * @param {integer} aFlags
   *   Flags that indicate the reason the location changed.  See the
   *   nsIWebProgressListener.LOCATION_CHANGE_* values.
   * @param {boolean} aIsSimulated
   *   True when this is called by tabbrowser due to switching tabs and
   *   undefined otherwise.  This parameter is not declared in
   *   nsIWebProgressListener.onLocationChange; see bug 1478348.
   */
  onLocationChange(aWebProgress, aRequest, aLocationURI, aFlags, aIsSimulated) {
    if (!aWebProgress.isTopLevel || !this.snapshotSelector) {
      return;
    }

    let browser = aWebProgress.browsingContext.embedderElement;
    let tab = browser.getTabBrowser()?.getTabForBrowser(browser);

    this.sendAsyncMessage("Companion:ViewLocation", {
      url: browser.documentURI.spec,
      oauthFlowService: tab?.getAttribute("pinebuild-oauth-flow"),
    });

    if (!InteractionsBlocklist.canRecordUrl(aLocationURI)) {
      // Reset the current URL for the snapshot selector, as this is a
      // non-web page, and we want to allow all snapshots to be displayed.
      this.snapshotSelector.setUrl();
      return;
    }

    let { gBrowser } = this.browsingContext.top.embedderElement.ownerGlobal;
    let referrerUrl =
      gBrowser.selectedBrowser.referrerInfo?.computedReferrerSpec;

    this.snapshotSelector.setUrl(aLocationURI.spec, referrerUrl);

    if (!selectByType) {
      return;
    }

    for (let [type, list] of Object.entries(DOMAIN_TYPES)) {
      for (let regex of list) {
        if (regex.test(aLocationURI.spec)) {
          this._pageType = type;
          this.snapshotSelector.setType(type);

          return;
        }
      }
    }

    this._pageType = null;
  }

  async _onSubscribe() {
    // If this doesn't exist, the companion has been closed already.
    // Return early to avoid test failures.
    if (!this.browsingContext.top.embedderElement?.ownerGlobal) {
      return;
    }
    let tabs = BrowserWindowTracker.orderedWindows.flatMap(w =>
      w.gBrowser.tabs.map(t => this.getTabData(t))
    );
    let newFavicons = this.consumeCachedFaviconsToSend();
    let stageManager = this.maybeGetStageManager();
    let sessions = await this.getSessionData();
    this.sendAsyncMessage("Companion:Setup", {
      tabs,
      connectedServices: OnlineServices.connectedServiceTypes,
      newFavicons,
      stageManager,
      sessions,
    });

    let {
      gBrowser,
      gStageManager,
    } = this.browsingContext.top.embedderElement.ownerGlobal;
    this.snapshotSelector = new SnapshotSelector({
      count: 5,
      filterAdult: true,
      selectOverlappingVisits: Services.prefs.getBoolPref(
        "browser.pinebuild.snapshots.relevancy.enabled",
        false
      ),
      selectCommonReferrer: Services.prefs.getBoolPref(
        "browser.pinebuild.snapshots.relevancy.enabled",
        false
      ),
      getCurrentSessionUrls: () =>
        new Set(gStageManager.views.map(view => view.url)),
    });
    let referrerUrl =
      gBrowser.selectedBrowser.referrerInfo?.computedReferrerSpec;
    this.snapshotSelector.setUrlAndRebuildNow(
      gBrowser.currentURI.spec,
      referrerUrl
    );

    gBrowser.addProgressListener(this);

    PageDataService.on("page-data", this._pageDataFound);

    this.snapshotSelector.on("snapshots-updated", async (_, snapshots) => {
      await this.ensureFaviconsCached(snapshots.map(s => s.url));
      let snapshotList = await Promise.all(
        snapshots.map(async s => ({
          snapshot: s,
          preview: await Snapshots.getSnapshotImageURL(s),
        }))
      );

      if (!this._destroyed) {
        this.sendAsyncMessage("Companion:SnapshotsChanged", {
          snapshots: snapshotList,
          newFavicons: this.consumeCachedFaviconsToSend(),
        });
      }
    });

    // To avoid a significant delay in initializing other parts of the UI,
    // we register the events separately.
    let events = await this.getEvents();
    this.sendAsyncMessage("Companion:RegisterCalendarEvents", {
      events,
      newFavicons: this.consumeCachedFaviconsToSend(),
    });

    Services.obs.notifyObservers(
      this.browsingContext.top.embedderElement.ownerGlobal,
      "companion-open"
    );
  }

  _onMuteAllTabs() {
    for (let tab of this._browserIdsToTabs.values()) {
      if (tab.soundPlaying && !tab.muted) {
        tab.toggleMuteAudio();
      }
    }
  }

  _onMediaControl(message) {
    let { browserId, command } = message.data;

    let tab = this._browserIdsToTabs.get(browserId);
    let mediaController = tab.linkedBrowser?.browsingContext?.mediaController;
    switch (command) {
      case "togglePlay": {
        if (mediaController.isPlaying) {
          mediaController.pause();
        } else {
          mediaController.play();
        }
        break;
      }
      case "toggleMute": {
        tab.toggleMuteAudio();
        break;
      }
      case "nextTrack": {
        mediaController.nextTrack();
        break;
      }
      case "prevTrack": {
        mediaController.prevTrack();
        break;
      }
    }
  }

  _onPauseAllMedia() {
    for (let tab of this._browserIdsToTabs.values()) {
      let mediaController = tab.linkedBrowser?.browsingContext?.mediaController;
      if (mediaController.isPlaying) {
        mediaController.pause();
      }
    }
  }

  _onFocusTab(message) {
    let { browserId } = message.data;
    let tab = this._browserIdsToTabs.get(browserId);
    tab.ownerGlobal.gBrowser.selectedTab = tab;
    tab.ownerGlobal.focus();
  }

  _onLaunchPip(message) {
    let { browserId } = message.data;
    let tab = this._browserIdsToTabs.get(browserId);
    let actor = tab.linkedBrowser?.browsingContext.currentWindowGlobal.getActor(
      "PictureInPictureLauncher"
    );
    actor?.sendAsyncMessage("PictureInPicture:CompanionToggle");
  }

  _onOpenURL(message) {
    let { url } = message.data;
    let uri = Services.io.newURI(url);
    if (!uri.scheme.startsWith("http")) {
      let extProtocolSvc = Cc[
        "@mozilla.org/uriloader/external-protocol-service;1"
      ].getService(Ci.nsIExternalProtocolService);
      let handlerInfo = extProtocolSvc.getProtocolHandlerInfo(uri.scheme);
      if (
        (handlerInfo.preferredAction == Ci.nsIHandlerInfo.useHelperApp ||
          handlerInfo.preferredAction == Ci.nsIHandlerInfo.useSystemDefault) &&
        !handlerInfo.alwaysAskBeforeHandling
      ) {
        // Avoiding a blank tab in the helper-app case.
        handlerInfo.launchWithURI(uri, null);
        return;
      }
    }
    this.browsingContext.topChromeWindow.openPinebuildCompanionLink(uri);
  }

  async _onDeleteSnapshot(message) {
    let { url } = message.data;
    await Snapshots.delete(url);
  }

  _onRestoreSession(message) {
    let { guid } = message.data;
    SessionManager.replaceSession(this.browsingContext.topChromeWindow, guid);
  }

  _onSetCharPref(message) {
    let { name, value } = message.data;
    if (!this.validateCompanionPref(name)) {
      return;
    }
    Services.prefs.setCharPref(name, value);
  }

  _onSetBoolPref(message) {
    let { name, value } = message.data;
    if (!this.validateCompanionPref(name)) {
      return;
    }
    Services.prefs.setBoolPref(name, value);
  }

  _onSetIntPref(message) {
    let { name, value } = message.data;
    if (!this.validateCompanionPref(name)) {
      return;
    }
    Services.prefs.setIntPref(name, value);
  }

  _onSetStageManagerViewIndex(message) {
    let { index } = message.data;
    let hist = this.browsingContext.topChromeWindow.gStageManager;
    hist.setView(hist.views[index]);
  }

  _onGetDocumentTitle(message) {
    let { url } = message.data;
    return OnlineServices.getDocumentTitle(url);
  }

  _onConnectService(message) {
    let { type } = message.data;
    OnlineServices.createService(type);
  }

  async _onGetOAuth2Tokens(message) {
    let {
      endpoint,
      tokenEndpoint,
      scopes,
      clientId,
      clientSecret,
      type,
    } = message.data;
    const authorizer = new OAuth2(
      endpoint,
      tokenEndpoint,
      scopes,
      clientId,
      clientSecret,
      null,
      type
    );
    await authorizer.connect();
    return authorizer.toJSON();
  }

  _onAccountCreated(message) {
    Services.obs.notifyObservers(null, "companion-signin", message.data.type);
  }

  _onAccountDeleted(message) {
    Services.obs.notifyObservers(null, "companion-signout", message.data.type);
  }

  _onOpen() {
    let win = this.browsingContext.topChromeWindow;
    let companion = win.document.getElementById("companion-box");
    if (!companion.isOpen) {
      companion.toggleVisible();
    }
    win.focus();
  }

  _onIsActiveWindow() {
    return !!Services.focus.activeWindow;
  }

  _onSuggestedSnapshotsPainted(message) {
    if (gTimestampsRecorded.has(message.name)) {
      return;
    }
    gTimestampsRecorded.add(message.name);

    let { time, extraData } = message.data;
    let processStart = Services.startup.getStartupInfo().process.getTime();
    let delta = time - processStart;
    Glean.pinebuild.suggestedSnapshotsPainted.setRaw(delta);
    Glean.pinebuild.suggestedSnapshotsCount.add(extraData.numberOfSnapshots);
  }

  _onCalendarPainted(message) {
    if (gTimestampsRecorded.has(message.name)) {
      return;
    }
    gTimestampsRecorded.add(message.name);

    let { time, extraData } = message.data;
    let processStart = Services.startup.getStartupInfo().process.getTime();
    let delta = time - processStart;
    Glean.pinebuild.calendarPainted.setRaw(delta);
    Glean.pinebuild.calendarEventCount.add(extraData.numberOfEvents);
  }

  QueryInterface = ChromeUtils.generateQI([
    "nsIWebProgressListener",
    "nsIWebProgressListener2",
    "nsISupportsWeakReference",
  ]);
}
