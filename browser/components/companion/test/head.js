/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

class CompanionHelper {
  static async withCalendarReady(taskFn) {
    let helper = new CompanionHelper();
    await helper.openCompanion();
    await helper.calendarReady;

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

  async runCompanionTask(taskFn, args = []) {
    await SpecialPowers.spawn(this.browser, args, taskFn);
  }

  get calendarReady() {
    return this.runCompanionTask(async () => {
      await content.window.gCalendarEventListener.initialized;
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
