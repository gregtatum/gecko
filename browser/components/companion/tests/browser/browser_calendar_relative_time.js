/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const ONE_MINUTE = 60 * 1000;

const { generateEventTimes } = PinebuildTestUtils;

add_setup(async function() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.companion.debugUI", true]],
  });
});

add_task(async function testRelativeTimeThirtyMinutesBeforeEvent() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test time stamp thirty minutes before event.");
    await helper.overrideRelativeTime(start, -30 * ONE_MINUTE);
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
        relativeTimeContent.hasAttribute("hidden"),
        true,
        "RelativeTime should be hidden"
      );
    });
  });
});

add_task(async function testRelativeTimeFifteenMinutesBeforeEvent() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test time stamp fifteen minutes before event.");
    await helper.overrideRelativeTime(start, -(15 * ONE_MINUTE));
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
        "companion-up-next",
        "RelativeTime has correct localization id"
      );
      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(JSON.parse(args).minutes, 15, "Should be 15 minutes until the event.");
    });
  });
});

add_task(async function testRelativeTimeTenMinutesBeforeEvent() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test time stamp ten minutes before event.");
    await helper.overrideRelativeTime(start, -(10 * ONE_MINUTE));
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
        "companion-starting-soon",
        "RelativeTime has correct localization id"
      );
      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(JSON.parse(args).minutes, 10, "Should be 10 minutes until the event.");
    });
  });
});

add_task(async function testRelativeTimeFiveMinutesBeforeEvent() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test time stamp five minutes before event.");
    await helper.overrideRelativeTime(start, -(5 * ONE_MINUTE));
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
      is(JSON.parse(args).minutes, 5, "Should be 5 minutes until the event.");
    });
  });
});

add_task(async function testRelativeTimeEventStarted() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test event started.");
    await helper.overrideRelativeTime(start, 0);
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
        "companion-happening-now",
        "RelativeTime has correct localization id"
      );
    });
  });
});

add_task(async function testRelativeTimeFifteenMinutesBeforeEventEnds() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test time stamp fifteen minutes before event ends.");
    await helper.overrideRelativeTime(start, 15 * ONE_MINUTE);
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
        "companion-ending-soon",
        "RelativeTime has correct localization id"
      );
      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(
        JSON.parse(args).minutes,
        15,
        "Should be 15 minutes until the event ends."
      );
    });
  });
});

add_task(async function testRelativeTimeTenMinutesBeforeEventEnds() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test time stamp ten minutes before event ends.");
    await helper.overrideRelativeTime(start, 20 * ONE_MINUTE);
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
        "companion-ending-soon",
        "RelativeTime has correct localization id"
      );
      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(
        JSON.parse(args).minutes,
        10,
        "Should be 10 minutes until the event ends."
      );
    });
  });
});

add_task(async function testRelativeTimeFiveMinutesBeforeEventEnds() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test time stamp five minutes before event ends.");
    await helper.overrideRelativeTime(start, 25 * ONE_MINUTE);
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
        "companion-almost-over",
        "RelativeTime has correct localization id"
      );
      let args = relativeTimeContent.getAttribute("data-l10n-args");
      is(
        JSON.parse(args).minutes,
        5,
        "Should be 5 minutes until the event ends."
      );
    });
  });
});

add_task(async function testRelativeTimeAfterEventEnds() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test time stamp after event ends.");
    await helper.overrideRelativeTime(start, 31 * ONE_MINUTE);
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
        "companion-event-finished",
        "RelativeTime has correct localization id"
      );
    });
  });
});

add_task(async function testRelativeTimeTransition() {
  await CompanionHelper.whenReady(async helper => {
    let { start, end } = generateEventTimes(0, 30, new Date());

    let events = [
      {
        summary: "My meeting",
        startDate: start,
        endDate: end,
      },
    ];

    info("Test time stamp thirty minutes before event.");
    await helper.overrideRelativeTime(start, -30 * ONE_MINUTE);
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
        relativeTimeContent.hasAttribute("hidden"),
        true,
        "RelativeTime should be hidden"
      );
    });

    info("Test time stamp fifteen minutes before event.");
    await helper.overrideRelativeTime(start, -15 * ONE_MINUTE);

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
        relativeTimeContent.hasAttribute("hidden"),
        false,
        "RelativeTime should not be hidden"
      );
    });
  });
});
