/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["CompanionChild"];

class CompanionChild extends JSWindowActorChild {
  handleEvent(event) {
    switch (event.type) {
      case "CompanionInit": {
        this.sendAsyncMessage("Companion:Subscribe");

        let win = this.browsingContext.window;
        let waivedContent = Cu.waiveXrays(win);
        let self = this;
        let CompanionUtils = {
          _tabs: new Map(),
          tabs() {
            return this._tabs.values();
          },

          sendAsyncMessage(name, detail) {
            self.sendAsyncMessage(name, detail);
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
        let { tabs } = message.data;
        let waivedContent = Cu.waiveXrays(this.browsingContext.window);
        waivedContent.CompanionUtils._tabs.clear();
        for (let tab of tabs) {
          waivedContent.CompanionUtils._tabs.set(tab.browserId, tab);
        }
        break;
      }
      case "Companion:TabAdded": {
        this.updateTab(message.data);
        break;
      }
      case "Companion:MediaEvent":
      case "Companion:TabAttrModified":
      case "Companion:TabPipToggleChanged": {
        this.updateTab(message.data.tab);
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
