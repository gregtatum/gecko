/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["CompanionParent", "gMediaControllers"];

const { BrowserWindowTracker } = ChromeUtils.import(
  "resource:///modules/BrowserWindowTracker.jsm"
);

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const { PlacesUtils } = ChromeUtils.import(
  "resource://gre/modules/PlacesUtils.jsm"
);

const NavHistory = Cc["@mozilla.org/browser/nav-history-service;1"].getService(
  Ci.nsINavHistoryService
);

class CompanionParent extends JSWindowActorParent {
  constructor() {
    super();
    this._mediaControllerIdsToTabs = new Map();
    this._browserIdsToTabs = new Map();

    this._observer = this.observe.bind(this);
    this._handleMediaEvent = this.handleMediaEvent.bind(this);
    this._handleTabEvent = this.handleTabEvent.bind(this);

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

    for (let win of BrowserWindowTracker.orderedWindows) {
      for (let tab of win.gBrowser.tabs) {
        this.registerTab(tab);
      }

      this.registerWindow(win);
    }
  }

  didDestroy() {
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

    for (let win of BrowserWindowTracker.orderedWindows) {
      for (let tab of win.gBrowser.tabs) {
        this.unregisterTab(tab);
      }

      this.unregisterWindow(win);
    }
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

  async getNavHistory() {
    let query = NavHistory.getNewQuery();
    // Two days of history
    query.beginTime = PlacesUtils.toPRTime(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    );
    query.endTime == null;

    let queryOptions = NavHistory.getNewQueryOptions();
    queryOptions.resultType = Ci.nsINavHistoryQueryOptions.RESULTS_AS_URI;
    queryOptions.sortingMode =
      Ci.nsINavHistoryQueryOptions.SORT_BY_VISITCOUNT_DESCENDING;
    queryOptions.queryType = Ci.nsINavHistoryQueryOptions.QUERY_TYPE_HISTORY;

    let results = NavHistory.executeQuery(query, queryOptions);
    results.root.containerOpen = true;

    try {
      let history = new Array(results.root.childCount);
      for (let i = 0; i < results.root.childCount; ++i) {
        let childNode = results.root.getChild(i);
        let newURI = Services.io.newURI(childNode.uri);
        let site = {
          title: childNode.title,
          type: childNode.type,
          RESULT_TYPE_URI: childNode.RESULT_TYPE_URI,
          uri: childNode.uri,
          uriHost: newURI.host,
          uriSpec: newURI.spec,
          icon: await this.getFavicon(childNode.uri, 16),
        };

        history[i] = site;
      }
      return history;
    } finally {
      results.root.containerOpen = false;
    }
  }

  observe(subj, topic, data) {
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
    }
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

  async receiveMessage(message) {
    switch (message.name) {
      case "Companion:Subscribe": {
        this.sendAsyncMessage("Companion:Setup", {
          tabs: BrowserWindowTracker.orderedWindows.flatMap(w =>
            w.gBrowser.tabs.map(t => this.getTabData(t))
          ),
          history: await this.getNavHistory(),
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
    }
  }
}
