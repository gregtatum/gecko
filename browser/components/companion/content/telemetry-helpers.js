/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let gTimestampsRecorded = new Set();
export function noteTelemetryTimestamp(messageName, extraData = null) {
  // There's no reason to send this if we've already sent it. Sending it twice
  // won't do anything, since we do the same filtering in the parent, but
  // there's no reason to send the message, so we don't.
  if (gTimestampsRecorded.has(messageName)) {
    return;
  }
  gTimestampsRecorded.add(messageName);
  requestAnimationFrame(function() {
    setTimeout(function() {
      window.CompanionUtils.sendAsyncMessage(messageName, {
        time: Date.now(),
        extraData,
      });
    }, 0);
  });
}
