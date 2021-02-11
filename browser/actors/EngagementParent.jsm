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
    if (msg.name == "Engagement:OpenGraph") {
      Engagement.getOpenGraph(msg.data);
    }
    if (msg.name == "Engagement:StartTimer") {
      Engagement.startTimer(msg.data);
    }
  }
}
