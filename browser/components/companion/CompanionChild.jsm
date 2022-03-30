/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["CompanionChild"];
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

class CompanionChild extends JSWindowActorChild {
  constructor() {
    super();
    this._cachedFavicons = new Map();
  }

  updateFaviconCache(newFavicons) {
    for (let entry of newFavicons) {
      if (entry.data) {
        // NOTE: honestly this is awkward and inefficient. We build a string
        // with String.fromCharCode and then btoa that. It's a Uint8Array
        // under the hood, and we should probably just expose something in
        // ChromeUtils to Base64 encode a Uint8Array directly, but this is
        // fine for now.
        let b64 = btoa(
          entry.data.reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );
        let dataUri = `data:${entry.mimeType};base64,${b64}`;
        this._cachedFavicons.set(entry.url, dataUri);
      }
    }
  }

  evictFaviconEntries(evictions) {
    for (let url of evictions) {
      this._cachedFavicons.delete(url);
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
          _initialSessionData: [],

          tabs() {
            return this._tabs.values();
          },
          initialSessionData() {
            return this._initialSessionData;
          },
          getFavicon(url) {
            return self._cachedFavicons.get(url);
          },
          sendAsyncMessage(name, detail) {
            self.sendAsyncMessage(name, detail);
          },
          sendQuery(name, detail) {
            return self.sendQuery(name, detail);
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
          openCompanion() {
            this.sendAsyncMessage("Companion:Open");
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

  // Note: unhandled/unknown messages are forwarded to content
  receiveMessage(message) {
    switch (message.name) {
      case "Companion:Setup": {
        let {
          tabs,
          newFavicons,
          connectedServices,
          stageManager,
          sessions,
        } = message.data;

        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.CompanionUtils._tabs.clear();
        for (let tab of tabs) {
          waivedContent.CompanionUtils._tabs.set(tab.browserId, tab);
        }
        waivedContent.CompanionUtils.connectedServices = connectedServices;
        waivedContent.CompanionUtils.stageManager = stageManager;

        this.updateFaviconCache(newFavicons);
        waivedContent.CompanionUtils._initialSessionData = sessions;
        break;
      }
      case "Companion:RegisterCalendarEvents":
      case "Companion:SnapshotsChanged": {
        let { newFavicons } = message.data;
        this.updateFaviconCache(newFavicons);
        break;
      }
      case "Companion:EvictFavicons": {
        let evictions = message.data;
        this.evictFaviconEntries(evictions);
        break;
      }
      case "Companion:TabAddedOrUpdated": {
        this.updateTab(message.data);
        break;
      }
      case "Companion:TabRemoved": {
        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.CompanionUtils._tabs.delete(message.data.browserId);
        break;
      }
      case "Companion:StageManagerEvent": {
        let { stageManager } = message.data;
        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        // Used for debugging.
        waivedContent.CompanionUtils.stageManager = stageManager;
        break;
      }
      case "Companion:ViewTab":
        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.document.getElementById(
          "companion-deck"
        ).selectedViewName = message.data.tab;
        break;
    }

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
