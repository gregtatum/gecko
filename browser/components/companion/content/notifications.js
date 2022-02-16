/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

let notificationTimers = new Set();

async function showNotification(event) {
  let notificationLevel = window.CompanionUtils.getIntPref(
    "browser.pinebuild.companion.notifications.level"
  );
  let isActiveWindow = await window.CompanionUtils.sendQuery(
    "Companion:IsActiveWindow"
  );
  if (notificationLevel == 0 || (notificationLevel == 2 && isActiveWindow)) {
    return;
  }

  let startTime = new Date(Date.parse(event.startDate));
  let endTime = new Date(Date.parse(event.endDate));
  let dateString = `${timeFormat.format(startTime)} - ${timeFormat.format(
    endTime
  )}`;

  let notification = new Notification(event.summary, {
    body: dateString,
    icon: "chrome://branding/content/icon64.png",
    tag: event.id,
  });
  notification.onclick = function() {
    window.CompanionUtils.openCompanion();
  };
}

function processEvents(e) {
  if (e.type != "refresh-events") {
    return;
  }
  for (let timer of notificationTimers) {
    clearTimeout(timer);
  }
  notificationTimers = new Set();
  let events;
  if (Services.prefs.getBoolPref("browser.pinebuild.workshop.enabled")) {
    /* Add workshop support here */
  } else {
    events = e.detail.events;
  }
  let notificationTimeout = window.CompanionUtils.getIntPref(
    "browser.pinebuild.companion.notifications.minutesBeforeEvent"
  );
  for (let event of events) {
    let notificationTime =
      new Date(event.startDate) - 60 * notificationTimeout * 1000;
    let now = Date.now();
    // This should be the same value as CALENDAR_UPDATE_TIME in calendar.js
    let inAMinute = now + 60 * 1000;

    if (notificationTime > now && notificationTime < inAMinute) {
      notificationTimers.add(
        setTimeout(showNotification, notificationTime - now, event)
      );
    }
  }
}

export function initNotifications() {
  // Getting refresh-events events from calendar.js
  document.addEventListener("refresh-events", processEvents);
}

export function uninitNotifications() {
  document.removeEventListener("refresh-events", processEvents);
}
