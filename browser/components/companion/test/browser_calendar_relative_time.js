/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function testRelativeTimeBeforeEvent() {
  await CompanionHelper.withCalendarReady(async helper => {
    let events = [
      {
        summary: "My meeting",
        start: "2021-07-30T17:30:00.000Z",
      },
    ];

    let fiveMinutes = 5 * 60 * 1000;
    info("Test time stamp five minutes before event.");
    await helper.overrideRelativeTime(-fiveMinutes);
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
        "companion-minutes-before-event",
        "RelativeTime has correct localization id"
      );

      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(JSON.parse(args).minutes, 5, "Should be five minutes ago.");
    });
  });
});

add_task(async function testRelativeTimeAfterEvent() {
  await CompanionHelper.withCalendarReady(async helper => {
    let events = [
      {
        summary: "My meeting",
        start: "2021-07-30T17:30:00.000Z",
      },
    ];

    let fiveMinutes = 5 * 60 * 1000;
    info("Test time stamp five minutes after event.");
    await helper.overrideRelativeTime(fiveMinutes);
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
        "companion-minutes-after-event",
        "RelativeTime has correct localization id"
      );

      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(
        JSON.parse(args).minutes,
        5,
        "Should be five minutes after the event."
      );
    });
  });
});
