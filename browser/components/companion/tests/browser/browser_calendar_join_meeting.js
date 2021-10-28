/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

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

add_task(async function test_joinMeetingButtonVisibility() {
  await CompanionHelper.whenReady(async helper => {
    let now = new Date();

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
        conference: {
          url: "http://example.com/joinme",
        },
        startDate: start,
        endDate: end,
      },
    ];

    info("Test button is visible for event starting within 10 mins");
    await helper.setCalendarEvents(events);
    await checkJoinBtnVisibility({ helper, expectedVisibility: true });

    // generate start and end times for event starting in 30 mins.
    let {
      start: newStart,
      end: newEnd,
    } = PinebuildTestUtils.generateEventTimes(
      0,
      30,
      now.getHours(),
      now.getMinutes() + 30
    );

    let newEvents = [
      {
        ...events[0],
        startDate: newStart,
        endDate: newEnd,
      },
    ];

    info(
      "Test button is hidden when event changes to start in more than 10 mins"
    );
    await helper.setCalendarEvents(newEvents);
    await checkJoinBtnVisibility({ helper, expectedVisibility: false });
  });
});
