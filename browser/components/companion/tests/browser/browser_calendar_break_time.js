/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals DEFAULT_FAKE_NOW_TS */

"use strict";

add_setup(async function() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.pinebuild.calendar.minBreakTime", 5],
      ["browser.pinebuild.calendar.maxBreakTime", 15],
    ],
  });
});

add_task(async function testBreakIndicatorsBetweenMeetings() {
  await CompanionHelper.whenReady(async helper => {
    // generate start and end times for a 10 min meeting starting now.
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(0, 10, now);

    // generate times for a meeting starting 10 minutes after the first meeting.
    const BREAK_TIME = 10;
    let nextEventStart = new Date(end);
    nextEventStart.setMinutes(nextEventStart.getMinutes() + BREAK_TIME);
    let {
      start: nextStart,
      end: nextEnd,
    } = PinebuildTestUtils.generateEventTimes(0, 10, nextEventStart);

    let events = [
      {
        summary: "First meeting",
        startDate: start,
        endDate: end,
      },
      {
        summary: "Another meeting later",
        startDate: nextStart,
        endDate: nextEnd,
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(
      async breakTime => {
        let calendarEventList = content.document.querySelector(
          "calendar-event-list"
        );
        let breaks = calendarEventList.shadowRoot.querySelectorAll(
          ".calendar-break-time"
        );
        is(breaks.length, 1, "Displays one break between meetings.");

        let breakLabel = breaks[0].querySelector(".calendar-break-time-text");
        let duration = content.document.l10n.getAttributes(breakLabel).args
          .duration;

        is(
          duration,
          breakTime,
          "Break indicates correct amount of time between meetings."
        );
      },
      [BREAK_TIME]
    );
  });
});

add_task(async function testBreakIndicatorsOverlappingMeetings() {
  await CompanionHelper.whenReady(async helper => {
    // generate start and end times for a 10 min meeting starting now.
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(0, 10, now);

    // generate times for a meeting starting 10 minutes after the first meeting.
    const BREAK_TIME = 10;
    let nextEventStart = new Date(end);
    nextEventStart.setMinutes(nextEventStart.getMinutes() + BREAK_TIME);
    let {
      start: nextStart,
      end: nextEnd,
    } = PinebuildTestUtils.generateEventTimes(0, 10, nextEventStart);

    let oneMinuteAgo = new Date(DEFAULT_FAKE_NOW_TS);
    oneMinuteAgo.setMinutes(oneMinuteAgo.getMinutes() - 1);
    let {
      start: overlapStart,
      end: overlapEnd,
    } = PinebuildTestUtils.generateEventTimes(0, 60, oneMinuteAgo);

    let events = [
      {
        id: "test-hide-me",
        summary: "An overlapping meeting",
        startDate: overlapStart,
        endDate: overlapEnd,
      },
      {
        summary: "First meeting",
        startDate: start,
        endDate: end,
      },
      {
        summary: "Another meeting later",
        startDate: nextStart,
        endDate: nextEnd,
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(
      async breakTime => {
        let calendarEventList = content.document.querySelector(
          "calendar-event-list"
        );
        let breaks = calendarEventList.shadowRoot.querySelectorAll(
          ".calendar-break-time"
        );
        is(breaks.length, 0, "Displays no break between meetings.");

        let event = calendarEventList.calendarEvents[0];
        is(
          event.event.summary,
          "An overlapping meeting",
          "Got the right meeting"
        );
        // FIXME(MR2-2884): Test support for hideEvent() is Workshop only.
        info("FIXME(MR2-2884) Dismiss overlapping event");
        calendarEventList.events = calendarEventList.events.slice(1);
        await calendarEventList.updateComplete;
        calendarEventList.onEventsUpdated({}, "refresh-events");
        await calendarEventList.updateComplete;

        breaks = calendarEventList.shadowRoot.querySelectorAll(
          ".calendar-break-time"
        );
        is(breaks.length, 1, "Displays a break after meeting is hidden");

        let breakLabel = breaks[0].querySelector(".calendar-break-time-text");
        let duration = content.document.l10n.getAttributes(breakLabel).args
          .duration;

        is(
          duration,
          breakTime,
          "Break indicates correct amount of time between meetings."
        );
      },
      [BREAK_TIME]
    );
  });
});
