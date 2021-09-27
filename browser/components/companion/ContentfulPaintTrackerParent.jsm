/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["ContentfulPaintTrackerParent"];

class ContentfulPaintTrackerParent extends JSWindowActorParent {
  async receiveMessage(message) {
    if (message.name != "ContentfulPaintTracker:FirstContentfulPaint") {
      Cu.reportError("Unexpected message type");
    }
    let event = new CustomEvent("TabFirstContentfulPaint");
    this.browsingContext.topChromeWindow?.gBrowser.dispatchEvent(event);
  }
}
