/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ContentTaskUtils } = ChromeUtils.import(
  "resource://testing-common/ContentTaskUtils.jsm"
);

add_task(async function testStatusTransitions() {
  // This depends on clock time and takes at least 20 seconds to finish.
  requestLongerTimeout(2);

  await CompanionHelper.whenReady(async helper => {
    registerCleanupFunction(async () => {
      await helper.runCompanionTask(() => {
        const CalendarEvent = content.customElements.get("calendar-event");
        CalendarEvent._resetBeforeStartOffsets();
      });
    });

    await helper.runCompanionTask(async () => {
      const CalendarEvent = content.customElements.get("calendar-event");
      CalendarEvent._mockBeforeStartOffsets(10 * 1000, 5 * 1000);
    });

    let fakeNow = new Date(DEFAULT_FAKE_NOW_TS);

    // generate start and end times for event starting in one minute.
    let { start, end } = PinebuildTestUtils.generateEventTimesFromNow({
      now: fakeNow,
      startFromNow: {
        seconds: 15,
      },
      duration: {
        seconds: 5,
      },
    });

    let events = [
      {
        summary: "Join my fun meeting",
        location: "http://meet.google.com/join",
        startDate: start,
        endDate: end,
      },
    ];

    await helper.setCalendarEvents(events);

    await helper.runCompanionTask(
      async defaultFakeNowTs => {
        let timeWarp = new Date(defaultFakeNowTs);
        let calendarEventList = content.document.querySelector(
          "calendar-event-list"
        );
        await calendarEventList.updateComplete;
        let event = calendarEventList.calendarEvents[0];
        await event.updateComplete;

        function assertEventState({ status, relativeTime, joinMeetingButton }) {
          is(event.status, status, `Status is ${status}`);
          is(
            !!event.relativeTime,
            relativeTime,
            `Relative time shown? ${relativeTime}`
          );
          is(
            !!joinMeetingButton,
            joinMeetingButton,
            `Join meeting button shown? ${joinMeetingButton}`
          );
        }

        async function assertNextEventState(expected) {
          timeWarp.setSeconds(timeWarp.getSeconds() + 5);
          event.setTimeWarp(timeWarp);

          await ContentTaskUtils.waitForEvent(event, "status-transition");
          await event.updateComplete;

          assertEventState(expected);
        }

        assertEventState({
          status: "future",
          relativeTime: false,
          joinMeetingButton: false,
        });

        await assertNextEventState({
          status: "up-next",
          relativeTime: true,
          joinMeetingButton: false,
        });

        await assertNextEventState({
          status: "upcoming",
          relativeTime: true,
          joinMeetingButton: true,
        });

        // Nothing really changes cause relative time uses its own timer.
        await assertNextEventState({
          status: "in-progress",
          relativeTime: true,
          joinMeetingButton: true,
        });

        await assertNextEventState({
          status: "finished",
          relativeTime: true,
          joinMeetingButton: false,
        });
      },
      [DEFAULT_FAKE_NOW_TS]
    );
  });
});
