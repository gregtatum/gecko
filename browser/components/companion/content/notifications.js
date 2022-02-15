/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

let notificationTimers = new Set();

async function isActiveWindow() {
  if (Services.appinfo.processType == Ci.nsIXULRuntime.PROCESS_TYPE_CONTENT) {
    let result = await window.CompanionUtils.sendQuery(
      "Companion:IsActiveWindow"
    );
    return result;
  }
  return !!Services.focus.activeWindow;
}

async function showNotification(event) {
  let notificationLevel = Services.prefs.getIntPref(
    "browser.pinebuild.companion.notifications.level"
  );
  // Show notifications if always enabled (1) or conditionally enabled (2)
  // and we have no active windows.
  if (
    notificationLevel == 0 ||
    (notificationLevel == 2 && (await isActiveWindow()))
  ) {
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
  notification.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (Services.appinfo.processType == Ci.nsIXULRuntime.PROCESS_TYPE_CONTENT) {
      window.CompanionUtils.openCompanion();
    } else {
      let browserWindow = Services.wm.getMostRecentWindow("navigator:browser");
      if (browserWindow) {
        browserWindow.focus();
      } else {
        const { openBrowserWindow } = ChromeUtils.import(
          "resource:///modules/BrowserContentHandler.jsm"
        );
        openBrowserWindow();
      }
    }
  };
}

function processEvents(events) {
  for (let timer of notificationTimers) {
    clearTimeout(timer);
  }
  notificationTimers = new Set();
  if (Services.prefs.getBoolPref("browser.pinebuild.workshop.enabled")) {
    /* Add workshop support here */
  }
  let notificationTimeout = Services.prefs.getIntPref(
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
  if (Services.appinfo.processType == Ci.nsIXULRuntime.PROCESS_TYPE_CONTENT) {
    document.addEventListener("refresh-events", function(e) {
      processEvents(e.detail.events);
    });
  } else {
    Services.obs.addObserver(function observe(subject) {
      let events = subject.wrappedJSObject;
      processEvents(events);
    }, "companion-services-refresh");
  }
}

export function uninitNotifications() {}
