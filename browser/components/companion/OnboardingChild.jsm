/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["OnboardingChild"];

class OnboardingChild extends JSWindowActorChild {
  messagePrefToWindow(prefValue) {
    let win = this.document.defaultView;
    let thisEvent = new win.CustomEvent("OnboardingProgressPrefValue", {
      detail: { prefValue },
    });
    win.dispatchEvent(thisEvent);
  }

  async handleEvent(event) {
    switch (event.type) {
      case "GetOnboardingProgressPrefValue":
        let prefValue = await this.sendQuery("GetOnboardingProgressPrefValue");
        this.messagePrefToWindow(prefValue);
        break;
      case "SetOnboardingProgressPrefValue":
        this.sendAsyncMessage(event.type, event.detail.newPrefValue);
        break;
      case "RecordEvent":
        this.sendAsyncMessage(event.type, event.detail);
        break;
      case "OpenFxa":
        this.sendAsyncMessage(event.type, event.detail.email);
        break;
      case "OnboardingCompleted":
      default:
        this.sendAsyncMessage(event.type);
        break;
    }
  }

  async receiveMessage(message) {
    switch (message.name) {
      case "OnboardingProgressPrefValueUpdated":
        let { prefValue } = message.data;
        this.messagePrefToWindow(prefValue);
    }
    return null;
  }
}
