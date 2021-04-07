/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["EngagementParent"];

ChromeUtils.defineModuleGetter(
  this,
  "Engagement",
  "resource:///modules/Engagement.jsm"
);

class EngagementParent extends JSWindowActorParent {
  receiveMessage(msg) {
    if (msg.name == "Engagement:Log") {
      Engagement.reportError(msg.data);
    } else if (msg.name == "Engagement:Engage") {
      Engagement.engage(this.browsingContext.embedderElement, msg.data);
    } else if (msg.name == "Engagement:Disengage") {
      Engagement.disengage(this.browsingContext.embedderElement, msg.data);
    }
  }
}
