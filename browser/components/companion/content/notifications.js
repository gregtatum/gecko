/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/**
 * Calendar Notifications
 *
 * ## Where does this get loaded?
 *
 * As an ES Module, this file will always be loaded in an (HTML) window with the
 * system principal.
 *
 * - When Workshop is not enabled:
 *   - When the pref "browser.startup.launchOnOSLogin" is set to true, enabling
 *     companion to run in the background even without any open windows,
 *     `browser/components/companion/content/pinebuildBackground.js` will
 *     dynamically import and call `initNotifications` from the parent process.
 *   - When the pref "browser.startup.launchOnOSLogin" is set to false,
 *     `browser/components/companion/content/companion.js` will call
 *     `initNotifications` in the privileged content process.  This file will
 *     currently always be imported.
 * - When workshop is enabled:
 *   - `browser/components/companion/content/workshopAPIParentAccess.js` (which
 *     is loaded by `browser/components/companion/WorkshopParentAccess.jsm`)
 *     will call `initNotifications` in the parent process.
 *
 * ## Notification Data Flow
 *
 * - `initNotifications` hooks things up so that `processEvents` will be invoked
 *   whenever the set of "now" events changes.
 * - `processEvents` clears all currently scheduled notifications and schedules
 *   new setTimeout timers with callbacks that will display the notification for
 *   the given notification at the appropriate time.
 **/

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const workshopEnabled = Services.prefs.getBoolPref(
  "browser.pinebuild.workshop.enabled"
);

XPCOMUtils.defineLazyGetter(globalThis, "logConsole", function() {
  return console.createInstance({
    prefix: "notifications.js",
    maxLogLevelPref: "browser.pinebuild.notifications.logLevel",
  });
});

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

let notificationTimers = new Set();

async function isActiveWindow() {
  let result;
  // Note: the workshop case will always find us running in the parent process.
  if (Services.appinfo.processType == Ci.nsIXULRuntime.PROCESS_TYPE_CONTENT) {
    result = await window.CompanionUtils.sendQuery("Companion:IsActiveWindow");
  } else {
    result = !!Services.focus.activeWindow;
  }
  logConsole.debug("isActiveWindow", result);
  return result;
}

async function showNotification(event) {
  logConsole.debug("showNotification");
  let notificationLevel = Services.prefs.getIntPref(
    "browser.pinebuild.companion.notifications.level"
  );
  // Show notifications if always enabled (1) or conditionally enabled (2)
  // and we have no active windows.
  if (
    notificationLevel == 0 ||
    (notificationLevel == 2 && (await isActiveWindow()))
  ) {
    logConsole.debug("Not showing notification");
    return;
  }

  let startTime = new Date(Date.parse(event.startDate));
  let endTime = new Date(Date.parse(event.endDate));
  let dateString = `${timeFormat.format(startTime)} - ${timeFormat.format(
    endTime
  )}`;

  logConsole.debug("Creating notification");
  let notification = new Notification(event.summary, {
    body: dateString,
    icon: "chrome://branding/content/icon64.png",
    // Workshop exposes an `originalId` which corresponds to the server id and
    // which will be identical across calendars, such as when the user has a
    // meeting on their personal calendar which is also on a shared team
    // calendar that they can see.
    //
    // We favor this over the `id` which will differ between calendars.  This
    // nets us consolidation of conceptually identical events for free-ish, as
    // notifications with the same tag will replace each other.  (However, there
    // could be some surprises with multiple triggerings, so we may need to
    // change this to involve a pre-pass unless we address this in the backend
    // for workshop.)
    tag: event.originalId || event.id,
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

function processEvents(events, now) {
  logConsole.debug("processEvents, now:", now);
  for (let timer of notificationTimers) {
    clearTimeout(timer);
  }
  notificationTimers = new Set();
  let notificationTimeout = Services.prefs.getIntPref(
    "browser.pinebuild.companion.notifications.minutesBeforeEvent"
  );
  for (let event of events) {
    let notificationTime =
      new Date(event.startDate) - 60 * notificationTimeout * 1000;
    if (notificationTime > now) {
      logConsole.debug("Adding timer for", event.summary);
      notificationTimers.add(
        setTimeout(showNotification, notificationTime - now, event)
      );
    }
  }
}

let observer = {
  observe(subject, topic, data) {
    switch (topic) {
      case "companion-services-refresh":
        let events = subject.wrappedJSObject;
        processEvents(events, Date.now());
        break;
    }
  },
  QueryInterface: ChromeUtils.generateQI([
    "nsISupportsWeakReference",
    "nsIObserver",
  ]),
};

class WorkshopNotificationDriver {
  constructor(workshopAPI) {
    this.workshopAPI = workshopAPI;

    // The view will update whenever the set of items in it changes or their
    // properties change.  However, if a fake time is in use, we only want to
    // process events each time the time-warp is broadcast from the UI in order
    // to avoid sync events from rolling the clock back.  This avoids delaying
    // the notifications more than expected and avoids the notifications
    // happening when we don't want them to.
    this.useFakeNow = workshopAPI.fakeNow;
    this.workshopAPI.on("time-warp", this, this.onTimeWarp);

    this.listView = null;

    this.rebuildListView();
  }

  rebuildListView() {
    if (this.listView) {
      this.listView.release();
      this.listView = null;
    }

    // We currently use the same spec as the "now" view and which, thanks to
    // cleverness in the backend, will end up reusing the same underlying
    // backing TOC, so there's no marginal cost to this.
    //
    // However, in the future this spec could potentially allow us to do things
    // like let users only receive notifications for specific calendars by
    // tagging calendars with "notifications" that we want notifications for.
    this.listView = this.workshopAPI.searchAllMessages({
      kind: "calendar",
      filter: {
        tag: "",
        event: {
          type: "now",
          durationBeforeInMinutes: 60,
        },
      },
    });

    this.listView.on("seeked", this, this.onSeeked);

    // But first we need to indicate what slice of the events list we want...
    // we want it all!  So we ask for the first 1000 things; anything more than
    // that is almost certainly a bug and not something we want to try and
    // handle.
    this.listView.seekToTop(10, 990);
  }

  onSeeked() {
    let useNow;
    if (this.useFakeNow) {
      useNow = this.useFakeNow;
      // consume `useFakeNow` so that the next time we seek we'll go into the
      // next branch which will early return.
      this.useFakeNow = null;
      logConsole.debug("processing first seek for fake now:", useNow);
    } else if (this.workshopAPI.fakeNow) {
      // Since `useFakeNow` must be null, we've already processed the fake
      // time once and should early return.
      return;
    } else {
      // The time is real!  Note that we're explicitly bypassing
      // workshopAPI.now() here because we believe it will end up being the
      // same as `new Date()`.
      useNow = Date.now();
      logConsole.debug("processing seek for real now:", useNow);
    }
    processEvents(this.listView.items, useNow);
  }

  onTimeWarp({ fakeNow }) {
    this.useFakeNow = fakeNow;
    this.rebuildListView();
  }
}

// We need to keep this object alive.
// eslint-disable-next-line no-unused-vars
let workshopNotificationDriver;
export function initNotifications(workshopAPI) {
  // Note: Currently we set the notification machinery and have the preference
  // to disable notifications take effect conditionally when we go to actually
  // show the notification.  It would be arguably more efficient to only start
  // this logic when the pref is enabled, but more prone to breakage.  Future
  // work!
  logConsole.debug("initNotifications", { workshopEnabled });
  if (workshopEnabled) {
    workshopNotificationDriver = new WorkshopNotificationDriver(workshopAPI);
  } else if (
    Services.appinfo.processType == Ci.nsIXULRuntime.PROCESS_TYPE_CONTENT
  ) {
    document.addEventListener("refresh-events", function(e) {
      processEvents(e.detail.events, Date.now());
    });
  } else {
    Services.obs.addObserver(observer, "companion-services-refresh", true);
  }
}
