/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["FlowResetChild"];

class FlowResetChild extends JSWindowActorChild {
  constructor() {
    super();
  }

  async handleEvent(event) {
    switch (event.type) {
      case "ViewCompanionBrowseTab":
      case "RestoreLastSession":
        this.sendAsyncMessage(event.type);
        break;
      case "DOMContentLoaded":
        this.sendAsyncMessage("FlowResetLoaded");
        let hasSession = await this.sendQuery("HasSession");
        this.contentWindow.document.dispatchEvent(
          new this.contentWindow.CustomEvent("HasSession", {
            detail: { hasSession },
          })
        );
    }
  }
}
