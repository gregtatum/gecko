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
  static async whenReady(taskFn) {
    let helper = new CompanionHelper();
    await helper.openCompanion();
    await helper.companionReady;

    await taskFn(helper);

    await helper.closeCompanion();
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
    return document.getElementById("companion-browser");
  }

  get companionBox() {
    return document.getElementById("companion-box");
  }

  get companionToggleButton() {
    return document.getElementById("companion-sidebar-button");
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
