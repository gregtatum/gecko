/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const checkOpenedUrl = async (helper, expected, btnSelector, index_ = 0) => {
  let openedUrl = helper.catchNextOpenedUrl();
  await helper.runCompanionTask(
    async (index, selector) => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      let event = visibleEvents[index];
      let openMenuButton = event.shadowRoot.querySelector(
        ".event-options-button"
      );
      let panelMenu = event.shadowRoot.querySelector("panel-list");
      const EventUtils = ContentTaskUtils.getEventUtils(content);
      info("Click the openMenuButton.");
      EventUtils.synthesizeMouseAtCenter(openMenuButton, {}, content);
      await ContentTaskUtils.waitForEvent(panelMenu, "shown");
      let panelButton = event.shadowRoot.querySelector(selector);
      ok(!panelButton.hidden, "Panel button is visible");
      panelButton.click();
    },
    [index_, btnSelector]
  );

  let url = await openedUrl;
  is(url, expected, "Expected URL was opened");
};

add_task(async function testRunningLate() {
  await CompanionHelper.whenReady(async helper => {
    await helper.runCompanionTask(() => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      is(visibleEvents.length, 0, "There are no events");
    });

    let events = [
      {
        summary: `My test event`,
        attendees: [{ email: "attendee@example.com", isSelf: false }],
        organizer: { email: "me@example.com", isSelf: true },
      },
      {
        summary: `Your test event`,
      },
    ];
    await helper.setCalendarEvents(events);

    await helper.runCompanionTask(() => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      is(visibleEvents.length, 2, "There are now 2 events");
    });

    await checkOpenedUrl(
      helper,
      "mailto:attendee@example.com?subject=Running late to meeting My test event",
      ".event-item-running-late-action"
    );

    await checkOpenedUrl(
      helper,
      "mailto:organizer@example.com?subject=Running late to meeting Your test event",
      ".event-item-running-late-action",
      1
    );
  });
});

add_task(async function testRunningLateXss() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: `My XSS event" onclick="alert('hi')""`,
        attendees: [{ email: "uhoh@example.com", isSelf: false }],
        organizer: { email: "organizer@example.com", isSelf: true },
        creator: { email: "creator@example.com", isSelf: true },
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      is(visibleEvents.length, 1, "There's an event");
    });

    await checkOpenedUrl(
      helper,
      `mailto:uhoh@example.com?subject=Running late to meeting My XSS event" onclick="alert('hi')""`,
      ".event-item-running-late-action"
    );
  });
});

add_task(async function testRunningLateNoAttendees() {
  await CompanionHelper.whenReady(async helper => {
    await helper.setCalendarEvents([
      {
        summary: "My personal event",
        organizer: { email: "me@example.com", isSelf: true },
        creator: { isSelf: true },
      },
    ]);

    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      is(visibleEvents.length, 1, "There's an event");
      let event = visibleEvents[0];
      let runningLateButton = event.shadowRoot.querySelector(
        ".event-item-running-late-action"
      );
      ok(runningLateButton.hidden, "The running late button is hidden");
    });
  });
});

add_task(async function testOpenInCalendar() {
  await CompanionHelper.whenReady(async helper => {
    const EVENT_URL = "https://www.example.com";

    let events = [
      {
        summary: "Event to open in calendar",
        url: EVENT_URL,
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      is(visibleEvents.length, 1, "There's an event");
    });

    await checkOpenedUrl(helper, EVENT_URL, ".event-item-open-calendar-action");
  });
});

add_task(async function testRunningLateSecondaryPersonal() {
  await CompanionHelper.whenReady(async helper => {
    await helper.setCalendarEvents([
      {
        summary: "Focus Time",
        organizer: { email: "123abc@calendar.google.com", isSelf: false },
        creator: { email: "me@example.com", isSelf: true },
      },
    ]);

    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      is(visibleEvents.length, 1, "There's an event");
      let event = visibleEvents[0];
      let runningLateButton = event.shadowRoot.querySelector(
        ".event-item-running-late-action"
      );
      ok(runningLateButton.hidden, "The running late button is hidden");
    });
  });
});
