/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["ViewActivationParent"];

class ViewActivationParent extends JSWindowActorParent {
  async receiveMessage(message) {
    if (message.name == "RequestActivation") {
      let {
        gStageManager,
      } = this.browsingContext.top.embedderElement?.ownerGlobal;
      if (gStageManager) {
        gStageManager.activateCurrentView();
      }
    }
  }
}
