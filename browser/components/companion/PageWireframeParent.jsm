/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["PageWireframeParent"];

class PageWireframeParent extends JSWindowActorParent {
  receiveMessage(message) {
    if (message.name != "Wireframe") {
      return;
    }
    let browser = this.browsingContext.embedderElement;
    let window = browser.ownerGlobal;
    let { wireframe } = message.data;
    window.gGlobalHistory.updateWireframe(browser, wireframe);
  }
}
