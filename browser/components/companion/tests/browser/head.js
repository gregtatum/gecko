/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  PlacesTestUtils: "resource://testing-common/PlacesTestUtils.jsm",
  PlacesUtils: "resource://gre/modules/PlacesUtils.jsm",
  Snapshots: "resource:///modules/Snapshots.jsm",
});

registerCleanupFunction(async () => {
  // Reload the companion in the main window, in case tests have been using that.
  let helper = new CompanionHelper(window);
  await helper.reload();
});

class CompanionHelper {
  static async whenReady(taskFn, browserWindow = window) {
    let helper = new CompanionHelper(browserWindow);
    helper.openCompanion();
    await helper.companionReady;

    await taskFn(helper);

    helper.closeCompanion();
  }

  constructor(browserWindow = window) {
    this.browserWindow = browserWindow;
  }

  openCompanion() {
    let companionBox = this.companionBox;
    if (companionBox.isOpen) {
      return;
    }

    // We intentionally click the button here rather than call
    // companionBox.toggleVisible. This is so that we can test that the button
    // is working properly.
    this.browserWindow.document
      .getElementById("companion-sidebar-button")
      .click();
  }

  closeCompanion() {
    let companionBox = this.companionBox;
    if (!companionBox.isOpen) {
      return;
    }

    // We intentionally click the button here rather than call
    // companionBox.toggleVisible. This is so that we can test that the button
    // is working properly.
    this.browserWindow.document
      .getElementById("companion-sidebar-button")
      .click();
  }

  async reload() {
    this.browser.reload();
    await BrowserTestUtils.browserLoaded(
      this.browser,
      false,
      "chrome://browser/content/companion/companion.xhtml"
    );
    await this.companionReady;
  }

  runCompanionTask(taskFn, args = []) {
    return SpecialPowers.spawn(this.browser, args, taskFn);
  }

  catchNextOpenedUrl() {
    info("catchNextOpenedUrl");
    return this.runCompanionTask(async () => {
      let oldOpenUrl = content.window.openUrl;
      try {
        return await new Promise(resolve => {
          content.window.openUrl = url => resolve(url);
        });
      } finally {
        content.window.openUrl = oldOpenUrl;
      }
    });
  }

  overrideRelativeTime(start, diff) {
    return this.runCompanionTask(
      async (startTime, timeDiff) => {
        content.window.RelativeTime.getNow = () => {
          return new Date(new Date(startTime).getTime() + timeDiff);
        };
      },
      [start, diff]
    );
  }

  get companionReady() {
    return this.runCompanionTask(async () => {
      await content.window.gInitialized;
    });
  }

  get browser() {
    return this.browserWindow.document.getElementById("companion-browser");
  }

  get companionBox() {
    return this.browserWindow.document.getElementsByTagName(
      "companion-manager"
    )[0];
  }

  get companionToggleButton() {
    return this.browserWindow.document.getElementById(
      "companion-sidebar-button"
    );
  }

  async setCalendarEvents(eventsData) {
    let oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    let standardizedEvents = eventsData
      .map(event => ({
        id: new Date(), // guarantee a unique id for this event
        start: new Date(),
        end: oneHourFromNow,
        links: [],
        conference: {},
        calendar: { id: "primary" },
        attendees: [],
        organizer: { email: "organizer@example.com", self: false },
        creator: { email: "creator@example.com", self: false },
        serviceId: 0,
        ...event,
      }))
      .sort((a, b) => a.start - b.start);
    await this.runCompanionTask(
      async events => {
        content.document.dispatchEvent(
          new content.window.CustomEvent("refresh-events", {
            detail: { events },
          })
        );
      },
      [standardizedEvents]
    );
  }
}

var PinebuildTestUtils = {
  /**
   * Waits for the <browser> to load, and then returns the current View.
   * This assumes that the desired load is going to result in a new View
   * that will become current.
   *
   * @param {Element} browser The <browser> that will start the load.
   * @param {String|null} [wantLoad=null]
   *        If a function, takes a URL and returns true if that's the load we're
   *        interested in. If a string, gives the URL of the load we're interested
   *        in. If not present, the first non-about:blank load is used.
   * @return {Promise}
   * @resolves With the View that is current after the load is completed.
   */
  async waitForNewView(browser, wantLoad = null) {
    await BrowserTestUtils.browserLoaded(browser, false, wantLoad);
    return browser.ownerGlobal.gGlobalHistory.currentView;
  },

  /**
   * Sets a View to be current, and waits for the ViewChanged event to fire.
   *
   * @param {View} view The View to make current.
   * @param {Window?} win
   *   The window to the view is from, the current window is used by default
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after setting the View.
   */
  setCurrentView(view, win = window) {
    let viewChangedPromise = BrowserTestUtils.waitForEvent(
      win.gGlobalHistory,
      "ViewChanged"
    );
    win.gGlobalHistory.setView(view);
    return viewChangedPromise;
  },

  /**
   * Helper assertion function that checks that two View references are
   * pointing at the same object. If not, logs some interesting things about
   * the unequal Views.
   *
   * @param {View} viewA The View to compare with viewB
   * @param {View} viewB The View to compare with viewA
   */
  assertEqualViews(viewA, viewB) {
    if (viewA === viewB) {
      Assert.ok(true, "Views are equal.");
    } else {
      Assert.ok(false, "Views are not equal.");
      info(`View A: ${viewA.title} - ${viewA.url.spec}\n`);
      info(`View B: ${viewB.title} - ${viewB.url.spec}\n`);
    }
  },

  /**
   * Helper assertion function that compares a window's array of Views and
   * compares their urls to those provided.
   *
   * @param {string[]} urls
   *   An Array of urls.
   * @param {Window?} win
   *   The window the views are from, the current window is used by default
   */
  assertUrlsAre(urls, win = window) {
    let riverUrls = win.gGlobalHistory.views.map(view => view.url.spec);
    Assert.deepEqual(riverUrls, urls);
  },

  /**
   * Helper assertion function that compares a window's array of
   * Views with viewArray and logs information if they don't match.
   *
   * @param {View[]} viewArray
   *   An Array of Views to compare with gGlobalHistory.views.
   * @param {Window?} win
   *   The window the views are from, the current window is used by default
   */
  assertViewsAre(viewArray, win = window) {
    if (win.gGlobalHistory.views.length != viewArray.length) {
      Assert.ok(false, "View lengths do not match.");
      return;
    }

    for (let i = 0; i < viewArray.length; ++i) {
      info(`Checking View at index ${i}`);
      this.assertEqualViews(win.gGlobalHistory.views[i], viewArray[i]);
    }
  },

  /**
   * Sends a window back a View.
   * @param {Window?} win
   *   The window to navigate, the current window is used by default
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after switching to the
   *           View.
   */
  async goBack(win = window) {
    let viewChangedPromise = BrowserTestUtils.waitForEvent(
      win.gGlobalHistory,
      "ViewChanged"
    );
    win.gGlobalHistory.goBack();
    return viewChangedPromise;
  },

  /**
   * Sends a window forward a View.
   * @param {Window?} win
   *   The window to navigate, the current window is used by default
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after switching to the
   *           View.
   */
  async goForward(win = window) {
    let viewChangedPromise = BrowserTestUtils.waitForEvent(
      win.gGlobalHistory,
      "ViewChanged"
    );
    win.gGlobalHistory.goForward();
    return viewChangedPromise;
  },

  /**
   * Test helper for generating a start time at 18:00 and an end time. By default,
   * the event's duration is only 30 minutes but can be set using the `eventHourDuration`
   * and `eventMinutesDuration` parameters.
   *
   * @param {Number}  eventDurationHours
   *        Optional. The hour duration of an event. Defaults to 0.
   * @param {Number}  eventDurationMinutes
   *        Optional. The remaining minute duration of an event. Defaults to 30.
   * @param {Number}  eventStartHour
   *        Optional. The starting hour for the event. Defaults to 18:00.
   * @param {Number}  eventStartMinutes
   *        Optional. The starting minutes for the event. Defaults to 0.
   * @return {Object} Object containing the event start and end times as ISO strings.
   */
  generateEventTimes(
    eventDurationHours = 0,
    eventDurationMinutes = 30,
    eventStartHour = 18,
    eventStartMinutes = 0
  ) {
    // Set start time
    let startTime = new Date();
    startTime.setHours(eventStartHour);
    startTime.setMinutes(eventStartMinutes);

    // Set end time
    let endTime = new Date(startTime);

    if (eventDurationHours > 0) {
      endTime.setHours(eventStartHour + eventDurationHours);
    }

    endTime.setMinutes(eventStartMinutes + eventDurationMinutes);

    return {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
    };
  },
};
