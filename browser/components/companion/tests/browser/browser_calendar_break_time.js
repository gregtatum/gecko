/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function setup() {
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
    let now = new Date();
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      0,
      10,
      now.getHours(),
      now.getMinutes()
    );

    // generate times for a meeting starting 10 minutes after the first meeting.
    const BREAK_TIME = 10;
    let meetingEnd = new Date(end);
    let {
      start: nextStart,
      end: nextEnd,
    } = PinebuildTestUtils.generateEventTimes(
      0,
      10,
      meetingEnd.getHours(),
      meetingEnd.getMinutes() + BREAK_TIME
    );

    let events = [
      {
        summary: "First meeting",
        start,
        end,
      },
      {
        summary: "Another meeting later",
        start: nextStart,
        end: nextEnd,
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
