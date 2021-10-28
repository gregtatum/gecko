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
  FileUtils: "resource://gre/modules/FileUtils.jsm",
  _LastSession: "resource:///modules/sessionstore/SessionStore.jsm",
  OnlineServices: "resource:///modules/OnlineServices.jsm",
  PageDataCollector: "resource:///modules/pagedata/PageDataCollector.jsm",
  PageDataService: "resource:///modules/pagedata/PageDataService.jsm",
  PlacesUtils: "resource://gre/modules/PlacesUtils.jsm",
  requestIdleCallback: "resource://gre/modules/Timer.jsm",
  SessionManager: "resource:///modules/SessionManager.jsm",
  Services: "resource://gre/modules/Services.jsm",
  setTimeout: "resource://gre/modules/Timer.jsm",
  Snapshots: "resource:///modules/Snapshots.jsm",
  SnapshotSelector: "resource:///modules/SnapshotSelector.jsm",
  Sqlite: "resource://gre/modules/Sqlite.jsm",
});

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "selectByType",
  "browser.companion.snapshots.selectByType",
  false
);

let sessionStart = new Date();
let lastSessionEnd = _LastSession.getState()?.session?.lastUpdate;

const PLACES_CACHE_EVICT_AFTER = 60 * 6 * 1000; // 6 minutes
// Give ourselves a little bit of a buffer when calling setTimeout to evict
// things from the places cache, otherwise we might end up scheduling
// setTimeouts more often than we would like.
const PLACES_EVICTION_TIMEOUT = PLACES_CACHE_EVICT_AFTER * 1.5;
const PREFERRED_SNAPSHOT_FAVICON_WIDTH_PX = 16;

// Defines pages that we force to show a certain snapshot type. The regular
// expresions are applied to the entire url.
const DOMAIN_TYPES = {
  [PageDataCollector.DATA_TYPE.PRODUCT]: [
    /^https:\/\/www\.walmart\.com\//,
    /^https:\/\/www\.target\.com\//,

    // Too liberal really.
    /^https:\/\/(smile|www)\.amazon\./,
  ],
};

class CompanionParent extends JSWindowActorParent {
  constructor() {
    super();
    this._browserIdsToTabs = new Map();
    this._cachedFaviconURLs = new Map();
    this._cachedFavicons = [];
    this._cachedPlacesTitles = new Map();
    this._pageType = null;
    this._destroyed = true;

    this._observer = this.observe.bind(this);
    this._handleTabEvent = this.handleTabEvent.bind(this);
    this._handleGlobalHistoryEvent = this.handleGlobalHistoryEvent.bind(this);
    this._handleViewLocationListener = this.handleViewLocationListener.bind(
      this
    );
    this._pageDataFound = this.pageDataFound.bind(this);
    this._handleSessionUpdate = this.handleSessionUpdate.bind(this);
    this._setupGlobalHistoryPrefObservers = this.setUpGlobalHistoryDebuggingObservers.bind(
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

    Services.prefs.addObserver(
      "browser.companion.globalhistorydebugging",
      this._setupGlobalHistoryPrefObservers
    );

    for (let win of BrowserWindowTracker.orderedWindows) {
      for (let tab of win.gBrowser.tabs) {
        this.registerTab(tab);
      }

      this.registerWindow(win);
    }
  }

  actorCreated() {
    this.setUpGlobalHistoryDebuggingObservers();
    let hist = this.browsingContext.topChromeWindow.gGlobalHistory;
    hist.addEventListener("ViewChanged", this._handleViewLocationListener);
    hist.addEventListener("ViewUpdated", this._handleViewLocationListener);
    this._destroyed = false;
    SessionManager.on("session-replaced", this._handleSessionUpdate);
    SessionManager.on("session-set-aside", this._handleSessionUpdate);
    SessionManager.on("sessions-updated", this._handleSessionUpdate);
    // Initialise the display of the last session UI.
    this.getSessionData();
  }

  setUpGlobalHistoryDebuggingObservers() {
    if (
      Services.prefs.getBoolPref("browser.companion.globalhistorydebugging")
    ) {
      let hist = this.browsingContext.topChromeWindow.gGlobalHistory;
      for (let event of [
        "ViewChanged",
        "ViewAdded",
        "ViewRemoved",
        "ViewUpdated",
        "ViewMoved",
      ]) {
        hist.addEventListener(event, this._handleGlobalHistoryEvent);
      }
    } else {
      this.removeGlobalHistoryDebuggingObservers();
    }
  }

  removeGlobalHistoryDebuggingObservers() {
    if (!this.browsingContext.topChromeWindow) {
      return;
    }
    let hist = this.browsingContext.topChromeWindow.gGlobalHistory;
    for (let event of [
      "ViewChanged",
      "ViewAdded",
      "ViewRemoved",
      "ViewUpdated",
      "ViewMoved",
    ]) {
      hist.removeEventListener(event, this._handleGlobalHistoryEvent);
    }
    hist.removeEventListener("ViewChanged", this._handleViewLocationListener);
    hist.removeEventListener("ViewUpdated", this._handleViewLocationListener);
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

    Services.prefs.removeObserver(
      "browser.companion.globalhistorydebugging",
      this._setupGlobalHistoryPrefObservers
    );

    this.removeGlobalHistoryDebuggingObservers();

    for (let win of BrowserWindowTracker.orderedWindows) {
      for (let tab of win.gBrowser.tabs) {
        this.unregisterTab(tab);
      }

      this.unregisterWindow(win);
    }

    if (this.snapshotSelector) {
      this.snapshotSelector.destroy();
      PageDataService.off("page-data", this._pageDataFound);
      PageDataService.off("no-page-data", this._pageDataFound);
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
    } catch (e) {}

    return {
      metadata,
      supportedKeys: controller.supportedKeys,
      isPlaying: controller.isPlaying,
    };
  }

  getTabData(tab) {
    // TODO: this getActor call will create the actor for every tab. If it doesn't exist,
    // we don't want to create it. I think we need to add a hasActor method for this, as
    // getExistingActor crashes (I don't think it's meant for that).
    let pipToggleParent = tab.linkedBrowser?.browsingContext?.currentWindowGlobal?.getActor(
      "PictureInPictureToggle"
    );

    return {
      browserId: tab.linkedBrowser?.browserId,
      media: this.getMediaData(tab),
      audioMuted: tab.linkedBrowser?.audioMuted,
      title: tab.linkedBrowser?.contentTitle,
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

  async getSessionData() {
    if (this._destroyed) {
      return;
    }
    let browser = this.browsingContext.top.embedderElement;
    if (!browser) {
      // The browser element has gone away, so skip the rest.
      return;
    }
    let width = this.#getFaviconWidth(this.browsingContext.top.embedderElement);
    let results = await SessionManager.query({ includePages: true });
    let first = results.find(session => session.pages.length);
    if (first) {
      for (const page of first.pages) {
        page.favicon = await this.getFavicon(page.url, width);
      }
      // If the child has already been closed, then bail out early to avoid
      // errors thrown in tests.
      if (this._destroyed) {
        return;
      }
      this.sendAsyncMessage("Companion:SessionUpdated", first);
    }
  }

  getFavicons(pages) {
    let browser = this.browsingContext.top.embedderElement;
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

  async getPreviewImageURL(url) {
    let placesDbPath = FileUtils.getFile("ProfD", ["places.sqlite"]).path;
    let previewImage;
    let db = await Sqlite.openConnection({ path: placesDbPath });
    try {
      let sql = "SELECT * FROM moz_places WHERE url = :url;";
      let rows = await db.executeCached(sql, { url });
      if (rows.length) {
        for (let row of rows) {
          previewImage = row.getResultByName("preview_image_url");
          if (previewImage) {
            break;
          }
        }
      }
    } finally {
      await db.close();
    }

    return previewImage;
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

      let db = await PlacesUtils.promiseDBConnection();
      for (let chunk of PlacesUtils.chunkArray(filtered, db.variableLimit)) {
        let rows = await db.executeCached(
          `SELECT url, title FROM moz_places
          WHERE url_hash IN (${Array(chunk.length)
            .fill("hash(?)")
            .join(",")})`,
          chunk
        );
        for (let row of rows) {
          let url = row.getResultByName("url");
          let title = row.getResultByName("title");
          this._cachedPlacesTitles.set(url, title);
          resultMap.set(url, title);
        }
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

  today() {
    let today = new Date();
    today.setHours(0);
    today.setMinutes(0);
    today.setSeconds(0);
    today.setMilliseconds(0);
    return today;
  }

  yesterday() {
    let yesterday = new Date(this.today() - 24 * 60 * 60 * 1000);
    // If yesterday is before the start of the session then push back by the time since the end of the
    // the last session
    if (yesterday < sessionStart && lastSessionEnd) {
      yesterday = new Date(yesterday - (sessionStart - lastSessionEnd));
    }
    return yesterday;
  }

  consumeCachedFaviconsToSend() {
    let result = this._cachedFavicons;
    this._cachedFavicons = [];
    return result;
  }

  getCurrentURI() {
    return this.browsingContext.topChromeWindow.gBrowser.currentURI.spec;
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
    let services = OnlineServices.getAllServices();
    if (!services.length) {
      this.sendAsyncMessage("Companion:ServiceDisconnected", {
        servicesConnected: false,
      });
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
          this.sendAsyncMessage("Companion:TabAdded", this.getTabData(tab));
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
        this.sendAsyncMessage("Companion:TabAdded", this.getTabData(subj));
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
            connectedServices: OnlineServices.connectedServiceTypes,
          });
        } else if (topic == "companion-signout") {
          this.sendAsyncMessage("Companion:SignOut", {
            service: data,
            connectedServices: OnlineServices.connectedServiceTypes,
          });
        }
        break;
      case "companion-services-refresh":
        let events = subj.wrappedJSObject;
        await this.populateAdditionalEventData(events);
        this.sendAsyncMessage("Companion:RegisterEvents", {
          events,
          newFavicons: this.consumeCachedFaviconsToSend(),
        });
        break;
      case "companion-submenu-change": {
        this.sendAsyncMessage("Companion:BrowsePanel");
        break;
      }
    }
  }

  viewTab(tab) {
    this.sendAsyncMessage("Companion:ViewTab", { tab });
  }

  handleGlobalHistoryEvent(event) {
    let globalHistory = this.maybeGetGlobalHistory();
    this.sendAsyncMessage("Companion:GlobalHistoryEvent", {
      globalHistory,
    });
    if (
      Services.prefs.getBoolPref("browser.companion.globalhistorydebugging")
    ) {
      // When debugging is enabled we only want to register one listener, so
      // this gets repurposed for the debug events and the view location events.
      this.handleViewLocationListener(event);
    }
  }

  handleViewLocationListener(event) {
    let { gBrowser } = this.browsingContext.top.embedderElement.ownerGlobal;
    let { selectedBrowser, selectedTab } = gBrowser;
    if (selectedBrowser.documentURI) {
      this.sendAsyncMessage("Companion:ViewLocation", {
        url: selectedBrowser.documentURI.spec,
        oauthFlowService: selectedTab.getAttribute("pinebuild-oauth-flow"),
      });
    }
  }

  handleTabEvent(event) {
    switch (event.type) {
      case "TabAttrModified": {
        this.sendAsyncMessage("Companion:TabAttrModified", {
          tab: this.getTabData(event.target),
          changed: event.detail.changed,
        });
        break;
      }
      case "TabPipToggleChanged": {
        this.sendAsyncMessage("Companion:TabPipToggleChanged", {
          tab: this.getTabData(event.target),
        });
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
      case "sessions-updated": {
        this.getSessionData();
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

  maybeGetGlobalHistory() {
    if (
      !Services.prefs.getBoolPref(
        "browser.companion.globalhistorydebugging",
        false
      )
    ) {
      return null;
    }

    let {
      internalViewsDebuggingOnly,
      currentView,
    } = this.browsingContext.topChromeWindow.gGlobalHistory;
    return internalViewsDebuggingOnly.map((v, i) => ({
      title: v.title,
      urlSpec: v.url.spec,
      state: v.state,
      isCurrent: v.view === currentView,
      index: i,
      historyState: v.historyState,
    }));
  }

  pageDataFound(event, pageData) {
    let { gBrowser } = this.browsingContext.top.embedderElement.ownerGlobal;
    if (
      selectByType &&
      !this._pageType &&
      this.snapshotSelector &&
      pageData.url == gBrowser.currentURI.spec
    ) {
      this.snapshotSelector.setType(pageData.data[0]?.type);
    }
  }

  async receiveMessage(message) {
    switch (message.name) {
      case "Companion:Subscribe": {
        // If this doesn't exist, the companion has been closed already.
        // Return early to avoid test failures.
        if (!this.browsingContext.top.embedderElement?.ownerGlobal) {
          return null;
        }
        let tabs = BrowserWindowTracker.orderedWindows.flatMap(w =>
          w.gBrowser.tabs.map(t => this.getTabData(t))
        );
        let newFavicons = this.consumeCachedFaviconsToSend();
        let currentURI = this.getCurrentURI();
        let servicesConnected = !!OnlineServices.getAllServices().length;
        let globalHistory = this.maybeGetGlobalHistory();
        this.sendAsyncMessage("Companion:Setup", {
          tabs,
          connectedServices: OnlineServices.connectedServiceTypes,
          servicesConnected,
          newFavicons,
          currentURI,
          globalHistory,
        });

        let { gBrowser } = this.browsingContext.top.embedderElement.ownerGlobal;
        this.snapshotSelector = new SnapshotSelector(5, true);
        this.snapshotSelector.setUrlAndRebuildNow(gBrowser.currentURI.spec);

        gBrowser.addProgressListener(this);

        PageDataService.on("page-data", this._pageDataFound);
        PageDataService.on("no-page-data", this._pageDataFound);

        this.snapshotSelector.on("snapshots-updated", async (_, snapshots) => {
          await this.ensureFaviconsCached(snapshots.map(s => s.url));

          if (!this._destroyed) {
            this.sendAsyncMessage("Companion:SnapshotsChanged", {
              snapshots,
              newFavicons: this.consumeCachedFaviconsToSend(),
            });
          }
        });

        // To avoid a significant delay in initializing other parts of the UI,
        // we register the events separately.
        let events = await this.getEvents();
        this.sendAsyncMessage("Companion:RegisterEvents", {
          events,
          newFavicons: this.consumeCachedFaviconsToSend(),
        });

        Services.obs.notifyObservers(
          this.browsingContext.top.embedderElement.ownerGlobal,
          "companion-open"
        );
        break;
      }
      case "Companion:MuteAllTabs": {
        for (let tab of this._browserIdsToTabs.values()) {
          if (tab.soundPlaying && !tab.muted) {
            tab.toggleMuteAudio();
          }
        }
        break;
      }
      case "Companion:MediaControl": {
        let { browserId, command } = message.data;

        let tab = this._browserIdsToTabs.get(browserId);
        let mediaController =
          tab.linkedBrowser?.browsingContext?.mediaController;
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
        break;
      }
      case "Companion:PauseAllMedia": {
        for (let tab of this._browserIdsToTabs.values()) {
          let mediaController =
            tab.linkedBrowser?.browsingContext?.mediaController;
          if (mediaController.isPlaying) {
            mediaController.pause();
          }
        }
        break;
      }
      case "Companion:FocusBrowser": {
        let { browserId } = message.data;
        let tab = this._browserIdsToTabs.get(browserId);
        tab.ownerGlobal.gBrowser.selectedTab = tab;
        tab.ownerGlobal.focus();
        break;
      }
      case "Companion:LaunchPip": {
        let { browserId } = message.data;
        let tab = this._browserIdsToTabs.get(browserId);
        let actor = tab.linkedBrowser?.browsingContext.currentWindowGlobal.getActor(
          "PictureInPictureLauncher"
        );
        actor?.sendAsyncMessage("PictureInPicture:CompanionToggle");
        break;
      }
      case "Companion:OpenURL": {
        let { url } = message.data;
        let uri = Services.io.newURI(url);
        if (!uri.scheme.startsWith("http")) {
          let extProtocolSvc = Cc[
            "@mozilla.org/uriloader/external-protocol-service;1"
          ].getService(Ci.nsIExternalProtocolService);
          let handlerInfo = extProtocolSvc.getProtocolHandlerInfo(uri.scheme);
          if (
            (handlerInfo.preferredAction == Ci.nsIHandlerInfo.useHelperApp ||
              handlerInfo.preferredAction ==
                Ci.nsIHandlerInfo.useSystemDefault) &&
            !handlerInfo.alwaysAskBeforeHandling
          ) {
            handlerInfo.launchWithURI(uri, null);
            return null;
          }
        }
        this.browsingContext.topChromeWindow.openPinebuildCompanionLink(uri);
        break;
      }
      case "Companion:DeleteSnapshot": {
        let { url } = message.data;
        await Snapshots.delete(url);
        break;
      }
      case "Companion:RestoreSession": {
        let { guid } = message.data;
        SessionManager.replaceSession(
          this.browsingContext.topChromeWindow,
          guid
        );
        break;
      }
      case "Companion:setCharPref": {
        let { name, value } = message.data;
        if (!this.validateCompanionPref(name)) {
          return null;
        }
        Services.prefs.setCharPref(name, value);
        break;
      }
      case "Companion:setBoolPref": {
        let { name, value } = message.data;
        if (!this.validateCompanionPref(name)) {
          return null;
        }
        Services.prefs.setBoolPref(name, value);
        break;
      }
      case "Companion:setIntPref": {
        let { name, value } = message.data;
        if (!this.validateCompanionPref(name)) {
          return null;
        }
        Services.prefs.setIntPref(name, value);
        break;
      }
      case "Companion:SetGlobalHistoryViewIndex": {
        let { index } = message.data;
        let hist = this.browsingContext.topChromeWindow.gGlobalHistory;
        hist.setView(hist.views[index]);
        break;
      }
      case "Companion:GetDocumentTitle": {
        let { url } = message.data;
        return OnlineServices.getDocumentTitle(url);
      }
      case "Companion:ConnectService": {
        let { type } = message.data;
        OnlineServices.createService(type);
      }
    }
    return null;
  }

  onLocationChange(aWebProgress, aRequest, aLocationURI, aFlags, aIsSimulated) {
    if (!aWebProgress.isTopLevel || !this.snapshotSelector) {
      return;
    }

    if (!aLocationURI.schemeIs("http") && !aLocationURI.schemeIs("https")) {
      return;
    }

    this.snapshotSelector.setUrl(aLocationURI.spec);

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

  QueryInterface = ChromeUtils.generateQI([
    "nsIWebProgressListener",
    "nsIWebProgressListener2",
    "nsISupportsWeakReference",
  ]);
}
