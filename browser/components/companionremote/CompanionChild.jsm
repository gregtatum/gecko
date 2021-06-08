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
      }
    }
  }

  receiveMessage(message) {
    this.passMessageDataToContent(message);
  }

  passMessageDataToContent(message) {
    this.sendToContent(message.name, message.data);
  }

  sendToContent(messageType, detail) {
    let win = this.document.defaultView;
    let message = Object.assign({ messageType }, { value: detail });
    let event = new win.CustomEvent("CompanionChromeToContent", {
      detail: Cu.cloneInto(message, win),
    });
    win.dispatchEvent(event);
  }
}
