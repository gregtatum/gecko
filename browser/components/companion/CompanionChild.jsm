/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["CompanionChild"];
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

class CompanionChild extends JSWindowActorChild {
  constructor() {
    super();
    this._cachedPlacesData = new Map();
  }

  updatePlacesCache(newPlacesCacheEntries) {
    for (let entry of newPlacesCacheEntries) {
      this._cachedPlacesData.set(entry.url, entry);
    }
  }

  evictPlacesCacheEntries(evictions) {
    for (let url of evictions) {
      this._cachedPlacesData.delete(url);
    }
  }

  handleEvent(event) {
    switch (event.type) {
      case "CompanionInit": {
        this.sendAsyncMessage("Companion:Subscribe");

        let win = this.browsingContext.window;
        let waivedContent = Cu.waiveXrays(win);
        let self = this;
        let CompanionUtils = {
          _tabs: new Map(),
          _observedPrefs: new Map(),

          isInAutomation: Cu.isInAutomation,
          tabs() {
            return this._tabs.values();
          },
          keyframes: {
            currentSession: [],
            workingOn: [],
          },
          snapshots: [],
          getPlacesData(url) {
            return self._cachedPlacesData.get(url);
          },
          services: [],
          events: [],
          sendAsyncMessage(name, detail) {
            self.sendAsyncMessage(name, detail);
          },
          getCharPref(name, defaultValue) {
            return Services.prefs.getCharPref(name, defaultValue);
          },
          getBoolPref(name, defaultValue) {
            return Services.prefs.getBoolPref(name, defaultValue);
          },
          getIntPref(name, defaultValue) {
            return Services.prefs.getIntPref(name, defaultValue);
          },
          setCharPref(name, value) {
            this.sendAsyncMessage("Companion:setCharPref", { name, value });
          },
          setBoolPref(name, value) {
            this.sendAsyncMessage("Companion:setBoolPref", { name, value });
          },
          setIntPref(name, value) {
            this.sendAsyncMessage("Companion:setIntPref", { name, value });
          },
          addPrefObserver(name, observer) {
            Services.prefs.addObserver(name, observer);
          },
          removePrefObserver(name, observer) {
            Services.prefs.removeObserver(name, observer);
          },
        };

        waivedContent.CompanionUtils = Cu.cloneInto(
          CompanionUtils,
          waivedContent,
          {
            cloneFunctions: true,
          }
        );
        break;
      }
    }
  }

  updateTab(tab) {
    let waivedContent = Cu.waiveXrays(this.browsingContext.window);
    waivedContent.CompanionUtils._tabs.set(tab.browserId, tab);
  }

  receiveMessage(message) {
    switch (message.name) {
      case "Companion:Setup": {
        let {
          tabs,
          keyframes,
          snapshots,
          newPlacesCacheEntries,
          currentURI,
          servicesConnected,
          globalHistory,
        } = message.data;

        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.CompanionUtils._tabs.clear();
        for (let tab of tabs) {
          waivedContent.CompanionUtils._tabs.set(tab.browserId, tab);
        }
        waivedContent.CompanionUtils.servicesConnected = servicesConnected;
        waivedContent.CompanionUtils.keyframes = keyframes;
        waivedContent.CompanionUtils.snapshots = snapshots;
        waivedContent.CompanionUtils.currentURI = currentURI;
        waivedContent.CompanionUtils.globalHistory = globalHistory;

        this.updatePlacesCache(newPlacesCacheEntries);

        break;
      }
      case "Companion:RegisterEvents": {
        let { events, newPlacesCacheEntries } = message.data;
        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.CompanionUtils.events = events;

        this.updatePlacesCache(newPlacesCacheEntries);
        break;
      }
      case "Companion:EvictPlacesData": {
        let evictions = message.data;
        this.evictPlacesCacheEntries(evictions);
        break;
      }
      case "Companion:ServiceDisconnected": {
        let { servicesConnected } = message.data;

        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.CompanionUtils.servicesConnected = servicesConnected;
        break;
      }
      case "Companion:TabAdded": {
        this.updateTab(message.data);
        break;
      }
      case "Companion:KeyframesChanged": {
        let { keyframes, newPlacesCacheEntries, currentURI } = message.data;

        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.CompanionUtils.keyframes = keyframes;
        waivedContent.CompanionUtils.currentURI = currentURI;

        this.updatePlacesCache(newPlacesCacheEntries);
        break;
      }
      case "Companion:SnapshotsChanged": {
        let { snapshots } = message.data;
        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.CompanionUtils.snapshots = snapshots;
        break;
      }
      case "Companion:MediaEvent":
      case "Companion:TabAttrModified":
      case "Companion:TabPipToggleChanged": {
        this.updateTab(message.data.tab);
        break;
      }
      case "Companion:GlobalHistoryEvent": {
        let { globalHistory } = message.data;
        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.CompanionUtils.globalHistory = globalHistory;
        break;
      }
    }

    this.passMessageDataToContent(message);
  }

  passMessageDataToContent(message) {
    this.sendToContent(message.name, message.data);
  }

  sendToContent(messageType, detail) {
    let win = this.document.defaultView;
    let event = new win.CustomEvent(messageType, {
      detail: Cu.cloneInto(detail, win),
    });
    win.dispatchEvent(event);
  }
}
