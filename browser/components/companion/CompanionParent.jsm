/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["CompanionParent", "gMediaControllers"];

const { BrowserWindowTracker } = ChromeUtils.import(
  "resource:///modules/BrowserWindowTracker.jsm"
);

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { Keyframes } = ChromeUtils.import("resource:///modules/Keyframes.jsm");
const { Sqlite } = ChromeUtils.import("resource://gre/modules/Sqlite.jsm");
const { _LastSession } = ChromeUtils.import(
  "resource:///modules/sessionstore/SessionStore.jsm"
);
const { clearTimeout, setTimeout, requestIdleCallback } = ChromeUtils.import(
  "resource://gre/modules/Timer.jsm"
);
const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);
const NavHistory = Cc["@mozilla.org/browser/nav-history-service;1"].getService(
  Ci.nsINavHistoryService
);
const { Snapshots } = ChromeUtils.import("resource:///modules/Snapshots.jsm");

const { FileUtils } = ChromeUtils.import(
  "resource://gre/modules/FileUtils.jsm"
);

let sessionStart = new Date();
let lastSessionEnd = _LastSession.getState()?.session?.lastUpdate;

const PLACES_CACHE_EVICT_AFTER = 60 * 6 * 1000; // 6 minutes
// Give ourselves a little bit of a buffer when calling setTimeout to evict
// things from the places cache, otherwise we might end up scheduling
// setTimeouts more often than we would like.
const PLACES_EVICTION_TIMEOUT = PLACES_CACHE_EVICT_AFTER * 1.5;

class CompanionParent extends JSWindowActorParent {
  constructor() {
    super();
    this._mediaControllerIdsToTabs = new Map();
    this._browserIdsToTabs = new Map();
    this._cachedPlacesURLs = new Map();
    this._cachedPlacesDataToSend = [];

    this._observer = this.observe.bind(this);
    this._handleMediaEvent = this.handleMediaEvent.bind(this);
    this._handleTabEvent = this.handleTabEvent.bind(this);
    this._handleGlobalHistoryEvent = this.handleGlobalHistoryEvent.bind(this);

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
    Services.obs.addObserver(this._observer, "keyframe-update");
    Services.obs.addObserver(this._observer, "places-snapshots-added");
    Services.obs.addObserver(this._observer, "places-snapshots-deleted");

    Services.obs.addObserver(this._observer, "companion-signin");
    Services.obs.addObserver(this._observer, "companion-signout");

    Services.prefs.addObserver(
      "browser.companion.globalhistorydebugging",
      this.setUpGlobalHistoryDebuggingObservers.bind(this)
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
  }

  didDestroy() {
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
    Services.obs.removeObserver(this._observer, "keyframe-update");
    Services.obs.removeObserver(this._observer, "places-snapshots-added");
    Services.obs.removeObserver(this._observer, "places-snapshots-deleted");

    Services.obs.addObserver(this._observer, "companion-signin");
    Services.obs.addObserver(this._observer, "companion-signout");

    this.removeGlobalHistoryDebuggingObservers();

    for (let win of BrowserWindowTracker.orderedWindows) {
      for (let tab of win.gBrowser.tabs) {
        this.unregisterTab(tab);
      }

      this.unregisterWindow(win);
    }
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
        let entries = [...this._cachedPlacesURLs.entries()];
        let evictions = [];
        for (let [url, expires] of entries) {
          if (expires <= now) {
            evictions.push(url);
            this._cachedPlacesURLs.delete(url);
          } else if (!nextExpiration || expires < nextExpiration) {
            nextExpiration = expires;
          }
        }
        this.sendAsyncMessage("Companion:EvictPlacesData", evictions);
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

  getWindowData(window) {
    return { id: BrowserWindowTracker.getBrowserWindowId(window) };
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

    let mediaController = tab.linkedBrowser?.browsingContext?.mediaController;
    if (mediaController) {
      mediaController.removeEventListener("activated", this._handleMediaEvent);
      mediaController.removeEventListener(
        "deactivated",
        this._handleMediaEvent
      );
      mediaController.removeEventListener(
        "supportedkeyschange",
        this._handleMediaEvent
      );
      mediaController.removeEventListener(
        "positionstatechange",
        this._handleMediaEvent
      );
      mediaController.removeEventListener(
        "metadatachange",
        this._handleMediaEvent
      );
      mediaController.removeEventListener(
        "playbackstatechange",
        this._handleMediaEvent
      );
      this._mediaControllerIdsToTabs.delete(mediaController.id);
    }
  }

  registerTab(tab) {
    if (tab.linkedBrowser) {
      this._browserIdsToTabs.set(tab.linkedBrowser.browserId, tab);
    }

    tab.addEventListener("TabPipToggleChanged", this._handleTabEvent);

    let mediaController = tab.linkedBrowser?.browsingContext?.mediaController;
    if (mediaController) {
      const options = {
        mozSystemGroup: true,
        capture: false,
      };

      mediaController.addEventListener(
        "activated",
        this._handleMediaEvent,
        options
      );
      mediaController.addEventListener(
        "deactivated",
        this._handleMediaEvent,
        options
      );
      mediaController.addEventListener(
        "supportedkeyschange",
        this._handleMediaEvent,
        options
      );
      mediaController.addEventListener(
        "positionstatechange",
        this._handleMediaEvent,
        options
      );
      mediaController.addEventListener(
        "metadatachange",
        this._handleMediaEvent,
        options
      );
      mediaController.addEventListener(
        "playbackstatechange",
        this._handleMediaEvent,
        options
      );
      this._mediaControllerIdsToTabs.set(mediaController.id, tab);
    }
  }

  registerWindow(win) {
    let tabs = win.gBrowser.tabContainer;
    tabs.addEventListener("TabAttrModified", this._handleTabEvent);
  }

  unregisterWindow(win) {
    let tabs = win.gBrowser.tabContainer;
    tabs.removeEventListener("TabAttrModified", this._handleTabEvent);
  }

  getFavicon(page, width = 0) {
    return new Promise(resolve => {
      let service = Cc["@mozilla.org/browser/favicon-service;1"].getService(
        Ci.nsIFaviconService
      );
      service.getFaviconDataForPage(
        Services.io.newURI(page),
        (uri, dataLength, data) => {
          if (uri) {
            resolve(uri.spec);
          } else {
            resolve(null);
          }
        },
        width
      );
    });
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

  async getPlacesData(url) {
    let query = NavHistory.getNewQuery();
    query.uri = Services.io.newURI(url);

    let queryOptions = NavHistory.getNewQueryOptions();
    queryOptions.resultType = Ci.nsINavHistoryQueryOptions.RESULTS_AS_URI;
    queryOptions.maxResults = 1;

    let results = NavHistory.executeQuery(query, queryOptions);
    results.root.containerOpen = true;
    try {
      if (results.root.childCount < 1) {
        return null;
      }

      let result = results.root.getChild(0);
      let favicon = await this.getFavicon(url, 16);

      if (!favicon) {
        return null;
      }

      let data = {
        url,
        title: result.title,
        icon: favicon,
        richIcon: await this.getFavicon(url),
        previewImage: await this.getPreviewImageURL(url),
      };
      return data;
    } finally {
      results.root.containerOpen = false;
    }
  }

  async ensurePlacesDataCached(url) {
    let cached = this._cachedPlacesURLs.has(url);
    if (!cached) {
      let data = await this.getPlacesData(url);
      if (data) {
        this._cachedPlacesDataToSend.push(data);
      }
    }

    this._cachedPlacesURLs.set(url, Date.now() + PLACES_CACHE_EVICT_AFTER);
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

  async getKeyframeData() {
    let currentSession = await Keyframes.query(this.today().getTime());
    let workingOn = await Keyframes.getTopKeypresses(
      this.yesterday().getTime()
    );
    for (let entry of currentSession) {
      await this.ensurePlacesDataCached(entry.url);
    }
    for (let entry of workingOn) {
      await this.ensurePlacesDataCached(entry.url);
    }
    return {
      currentSession,
      workingOn,
    };
  }

  consumeCachedPlacesDataToSend() {
    let result = this._cachedPlacesDataToSend;
    this._cachedPlacesDataToSend = [];
    return result;
  }

  getCurrentURI() {
    return this.browsingContext.topChromeWindow.gBrowser.currentURI.spec;
  }

  async getEvents() {
    let services = OnlineServices.getServices();
    if (!services.length) {
      this.sendAsyncMessage("Companion:ServiceDisconnected", {
        servicesConnected: false,
      });
      return [];
    }

    let meetingResults = new Array(services.length);
    let i = 0;
    for (let service of services) {
      meetingResults[i] = service.getNextMeetings();
      i++;
    }
    let eventResults = await Promise.allSettled(meetingResults);
    let events = eventResults.flatMap(r => r.value || []);

    return events;
  }

  /**
   * Returns a list of the most relevant snapshots.
   * TODO: Use more sophisticated heuristics here, possibly by sorting on a
   * relevancy score stored in the Snapshots DB.
   * @returns {array} A list of snapshots.
   */
  async getSnapshots() {
    return Snapshots.query();
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
      case "keyframe-update": {
        let keyframes = await this.getKeyframeData();
        let newPlacesCacheEntries = this.consumeCachedPlacesDataToSend();
        let currentURI = this.getCurrentURI();
        this.sendAsyncMessage("Companion:KeyframesChanged", {
          keyframes,
          newPlacesCacheEntries,
          currentURI,
        });
        break;
      }
      case "places-snapshots-added":
      case "places-snapshots-deleted": {
        let snapshots = await this.getSnapshots();
        this.sendAsyncMessage("Companion:SnapshotsChanged", {
          snapshots,
        });
        break;
      }
      case "companion-signin":
      case "companion-signout":
        this.updateEvents();
        break;
    }
  }

  handleGlobalHistoryEvent(event) {
    let globalHistory = this.maybeGetGlobalHistory();
    this.sendAsyncMessage("Companion:GlobalHistoryEvent", {
      globalHistory,
    });
  }

  handleMediaEvent(event) {
    let tab = this._mediaControllerIdsToTabs.get(event.target.id);
    if (!tab) {
      return;
    }
    this.sendAsyncMessage("Companion:MediaEvent", {
      tab: this.getTabData(tab),
      eventType: event.type,
    });
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

  async updateEvents() {
    let events = await this.getEvents();
    for (let event of events) {
      for (let link of event.links) {
        await this.ensurePlacesDataCached(link.url);
      }
    }
    this.sendAsyncMessage("Companion:RegisterEvents", {
      events,
      newPlacesCacheEntries: this.consumeCachedPlacesDataToSend(),
    });
  }

  async receiveMessage(message) {
    switch (message.name) {
      case "Companion:Subscribe": {
        let tabs = BrowserWindowTracker.orderedWindows.flatMap(w =>
          w.gBrowser.tabs.map(t => this.getTabData(t))
        );
        let keyframes = await this.getKeyframeData();
        let snapshots = await this.getSnapshots();
        let newPlacesCacheEntries = this.consumeCachedPlacesDataToSend();
        let currentURI = this.getCurrentURI();
        let servicesConnected = !!OnlineServices.getServices().length;
        let globalHistory = this.maybeGetGlobalHistory();
        this.sendAsyncMessage("Companion:Setup", {
          tabs,
          servicesConnected,
          keyframes,
          snapshots,
          newPlacesCacheEntries,
          currentURI,
          globalHistory,
        });

        // To avoid a significant delay in initializing other parts of the UI,
        // we register the events separately.
        let events = await this.getEvents();
        for (let event of events) {
          for (let link of event.links) {
            await this.ensurePlacesDataCached(link.url);
          }
        }
        this.sendAsyncMessage("Companion:RegisterEvents", {
          events,
          newPlacesCacheEntries: this.consumeCachedPlacesDataToSend(),
        });
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
        this.browsingContext.topChromeWindow.switchToTabHavingURI(url, true, {
          ignoreFragment: true,
        });
        break;
      }
      case "Companion:setCharPref": {
        let { name, value } = message.data;
        if (!this.validateCompanionPref(name)) {
          return;
        }
        Services.prefs.setCharPref(name, value);
        break;
      }
      case "Companion:setBoolPref": {
        let { name, value } = message.data;
        if (!this.validateCompanionPref(name)) {
          return;
        }
        Services.prefs.setBoolPref(name, value);
        break;
      }
      case "Companion:setIntPref": {
        let { name, value } = message.data;
        if (!this.validateCompanionPref(name)) {
          return;
        }
        Services.prefs.setIntPref(name, value);
        break;
      }
      case "Companion:OpenCalendar": {
        let { event } = message.data;
        OnlineServices.findServiceById(event.serviceId).openCalendar(event);
        break;
      }
      case "Companion:GetEvents": {
        this.updateEvents();
        break;
      }
      case "Companion:SetGlobalHistoryViewIndex": {
        let { index } = message.data;
        let hist = this.browsingContext.topChromeWindow.gGlobalHistory;
        hist.setView(hist.views[index]);
        break;
      }
    }
  }
}
