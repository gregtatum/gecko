/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals DEFAULT_FAKE_NOW_TS */

"use strict";

add_task(async function test5HourEvent() {
  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(5, 30, now);

    let events = [
      {
        summary: "5 Hour Meeting",
        startDate: start,
        endDate: end,
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = await ContentTaskUtils.waitForCondition(() => {
        return calendarEventList.shadowRoot.querySelector("calendar-event");
      });
      ok(event, "5 hour meeting is shown.");
    });
  });
});

add_task(async function test12HourEvent() {
  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      12,
      30,
      now.getHours()
    );

    let events = [
      {
        summary: "12 Hour Meeting",
        startDate: start,
        endDate: end,
      },
    ];

    await helper.setCalendarEvents(events, { expectedEventCount: 0 });
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      ok(!event, "12 hour meeting is not shown.");
    });
  });
});

add_task(async function testMultiDayEvent() {
  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      48,
      30,
      now.getHours()
    );

    let events = [
      {
        summary: "Multi Day Meeting",
        startDate: start,
        endDate: end,
      },
    ];

    await helper.setCalendarEvents(events, { expectedEventCount: 0 });
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      ok(!event, "multi day meeting is not shown.");
    });
  });
});
