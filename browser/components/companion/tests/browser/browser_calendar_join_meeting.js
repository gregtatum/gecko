/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals DEFAULT_FAKE_NOW_TS */

"use strict";

const { ContentTaskUtils } = ChromeUtils.import(
  "resource://testing-common/ContentTaskUtils.jsm"
);

const checkJoinBtnVisibility = async ({ helper, expectedVisibility }) => {
  await helper.runCompanionTask(
    async isVisible => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      await calendarEventList.updateComplete;
      let joinBtn = event.shadowRoot.querySelector(
        ".event-actions .button-link"
      );

      let styles = content.getComputedStyle(joinBtn);
      let hiddenStylesApplied =
        styles["clip-path"] == "inset(50%)" &&
        styles.overflow == "hidden" &&
        styles.width == "1px";

      is(
        !hiddenStylesApplied,
        isVisible,
        `Join button is ${isVisible ? "visible" : "hidden"}`
      );
    },
    [expectedVisibility]
  );
};

add_task(async function test_joinMeetingButtonShown() {
  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);

    // generate start and end times for event starting in one minute.
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      0,
      30,
      now.getHours(),
      now.getMinutes() + 1
    );

    let events = [
      {
        summary: "Join my fun meeting",
        location: "http://meet.google.com/join",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test button is visible for event starting within 10 mins");
    await helper.setCalendarEvents(events);
    await checkJoinBtnVisibility({ helper, expectedVisibility: true });
  });
});

add_task(async function test_joinMeetingButtonHidden() {
  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);

    // generate start and end times for event starting in 30 mins.
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      0,
      30,
      now.getHours(),
      now.getMinutes() + 30
    );

    let events = [
      {
        summary: "Join my fun meeting",
        location: "http://meet.google.com/join",
        startDate: start,
        endDate: end,
      },
    ];

    info(
      "Test button is hidden when event changes to start in more than 10 mins"
    );
    await helper.setCalendarEvents(events);
    await checkJoinBtnVisibility({ helper, expectedVisibility: false });
  });
});
