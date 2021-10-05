/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const FIVE_MINUTES = 5 * 60 * 1000;
const ONE_HOUR = 1000 * 60 * 60;

add_task(async function setup() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.companion.debugUI", true]],
  });
});

add_task(async function testRelativeTimeMinutesBeforeEvent() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = PinebuildTestUtils.generateEventTimes();

    let events = [
      {
        summary: "My meeting",
        start,
        end,
      },
    ];

    info("Test time stamp five minutes before event.");
    await helper.overrideRelativeTime(start, -FIVE_MINUTES);
    await helper.setCalendarEvents(events);

    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );

      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      let eventRelativeTime = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector("relative-time");
      });

      let relativeTimeContent = eventRelativeTime.shadowRoot.querySelector(
        ".event-relative-time"
      );

      is(
        relativeTimeContent.getAttribute("data-l10n-id"),
        "companion-until-event-minutes",
        "RelativeTime has correct localization id"
      );

      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(JSON.parse(args).minutes, 5, "Should be in five minutes.");
    });
  });
});

add_task(async function testRelativeTimeMinutesAfterEvent() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = PinebuildTestUtils.generateEventTimes();

    let events = [
      {
        summary: "My meeting",
        start,
        end,
      },
    ];

    info("Test time stamp five minutes after event.");
    await helper.overrideRelativeTime(start, FIVE_MINUTES);
    await helper.setCalendarEvents(events);

    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      let eventRelativeTime = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector("relative-time");
      });

      let relativeTimeContent = eventRelativeTime.shadowRoot.querySelector(
        ".event-relative-time"
      );
      is(
        relativeTimeContent.getAttribute("data-l10n-id"),
        "companion-happening-now-minutes",
        "RelativeTime has correct localization id"
      );

      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(
        JSON.parse(args).minutes,
        25,
        "Should be 25 minutes left of the event."
      );
    });
  });
});

add_task(async function testRelativeTimeHoursAndMinutesAfterEvent() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = PinebuildTestUtils.generateEventTimes(1);
    let events = [
      {
        summary: "My meeting",
        start,
        end,
      },
    ];

    info("Test time stamp five minutes after event.");
    await helper.overrideRelativeTime(start, FIVE_MINUTES);
    await helper.setCalendarEvents(events);

    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      let eventRelativeTime = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector("relative-time");
      });

      let relativeTimeContent = eventRelativeTime.shadowRoot.querySelector(
        ".event-relative-time"
      );
      is(
        relativeTimeContent.getAttribute("data-l10n-id"),
        "companion-happening-now-both",
        "RelativeTime has correct localization id"
      );

      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(JSON.parse(args).hours, 1, "Should be 1 hour left of the event.");
      is(
        JSON.parse(args).minutes,
        25,
        "Should be 25 minutes left of the event."
      );
    });
  });
});

add_task(async function testRelativeTimeHoursBeforeEvent() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = PinebuildTestUtils.generateEventTimes(1);
    let events = [
      {
        summary: "My meeting",
        start,
        end,
      },
    ];

    info("Test time stamp an hour before event.");
    await helper.overrideRelativeTime(start, -ONE_HOUR);
    await helper.setCalendarEvents(events);

    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      let eventRelativeTime = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector("relative-time");
      });

      let relativeTimeContent = eventRelativeTime.shadowRoot.querySelector(
        ".event-relative-time"
      );
      is(
        relativeTimeContent.getAttribute("data-l10n-id"),
        "companion-until-event-hours",
        "RelativeTime has correct localization id"
      );

      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(JSON.parse(args).hours, 1, "Should be 1 hour before.");
    });
  });
});

add_task(async function testRelativeTimeHoursAndMinutesBeforeEvent() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = PinebuildTestUtils.generateEventTimes(1);
    let events = [
      {
        summary: "My meeting",
        start,
        end,
      },
    ];

    info("Test time stamp an hour and five minutes before event.");
    await helper.overrideRelativeTime(start, -(ONE_HOUR + FIVE_MINUTES));
    await helper.setCalendarEvents(events);

    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      let eventRelativeTime = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector("relative-time");
      });

      let relativeTimeContent = eventRelativeTime.shadowRoot.querySelector(
        ".event-relative-time"
      );
      is(
        relativeTimeContent.getAttribute("data-l10n-id"),
        "companion-until-event-both",
        "RelativeTime has correct localization id"
      );

      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(JSON.parse(args).hours, 1, "Should be 1 hour before.");
      is(
        JSON.parse(args).minutes,
        5,
        "Remaining minutes before event should be 5."
      );
    });
  });
});
