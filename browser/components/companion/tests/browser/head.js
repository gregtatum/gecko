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

class CompanionHelper {
  static async whenReady(taskFn, browserWindow = window) {
    let helper = new CompanionHelper(browserWindow);
    await helper.openCompanion();
    await helper.companionReady;

    await taskFn(helper);

    await helper.closeCompanion();
  }

  constructor(browserWindow = window) {
    this.browserWindow = browserWindow;
  }

  async openCompanion() {
    if (CompanionService.isOpen) {
      return;
    }
    let companionInitializedPromise;
    let browserAdded = BrowserTestUtils.waitForMutationCondition(
      this.companionBox,
      { childList: true },
      () => {
        if (!this.browser) {
          return false;
        }
        companionInitializedPromise = BrowserTestUtils.waitForContentEvent(
          this.browser,
          "CompanionInit"
        );
        return true;
      }
    );
    CompanionService.openCompanion();
    await browserAdded;
    await companionInitializedPromise;
  }

  async closeCompanion() {
    if (!CompanionService.isOpen) {
      return;
    }
    let { browser, companionBox } = this;
    CompanionService.closeCompanion();
    await BrowserTestUtils.waitForMutationCondition(
      companionBox,
      { childList: true },
      () => !browser.isConnected
    );
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
    return this.browserWindow.document.getElementById("companion-box");
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
    return gGlobalHistory.currentView;
  },

  /**
   * Sets a View to be current, and waits for the ViewChanged event to fire.
   *
   * @param {View} view The View to make current.
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after setting the View.
   */
  setCurrentView(view) {
    let viewChangedPromise = BrowserTestUtils.waitForEvent(
      gGlobalHistory,
      "ViewChanged"
    );
    gGlobalHistory.setView(view);
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
   * Helper assertion function that compares the current windows array of
   * Views with viewArray and logs information if they don't match.
   *
   * @param {View[]} viewArray
   *        An Array of Views to compare with gGlobalHistory.views.
   */
  assertViewsAre(viewArray) {
    if (gGlobalHistory.views.length != viewArray.length) {
      Assert.ok(false, "View lengths do not match.");
      return;
    }

    for (let i = 0; i < viewArray.length; ++i) {
      info(`Checking View at index ${i}`);
      this.assertEqualViews(gGlobalHistory.views[i], viewArray[i]);
    }
  },

  /**
   * Sends the current window back a View.
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after switching to the
   *           View.
   */
  async goBack() {
    let viewChangedPromise = BrowserTestUtils.waitForEvent(
      gGlobalHistory,
      "ViewChanged"
    );
    gGlobalHistory.goBack();
    return viewChangedPromise;
  },

  /**
   * Sends the current window forward a View.
   * @return {Promise}
   * @resolves With the ViewChanged event that fired after switching to the
   *           View.
   */
  async goForward() {
    let viewChangedPromise = BrowserTestUtils.waitForEvent(
      gGlobalHistory,
      "ViewChanged"
    );
    gGlobalHistory.goForward();
    return viewChangedPromise;
  },
};
