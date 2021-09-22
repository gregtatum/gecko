/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const checkMailtoUrl = async (helper, index_, expected) => {
  let openedUrl = helper.catchNextOpenedUrl();
  await helper.runCompanionTask(
    async index => {
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
      info("Simulate a hover over the openMenuButton for it to appear.");
      EventUtils.synthesizeMouseAtCenter(
        openMenuButton,
        { type: "mousemove" },
        content
      );
      info("Now click to open the menu.");
      EventUtils.synthesizeMouseAtCenter(openMenuButton, {}, content);
      await ContentTaskUtils.waitForEvent(panelMenu, "shown");
      let runningLateButton = event.shadowRoot.querySelector(
        ".event-item-running-late-action"
      );
      ok(!runningLateButton.hidden, "Running late button is visible");
      runningLateButton.click();
    },
    [index_]
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
        attendees: [{ email: "attendee@example.com", self: false }],
        organizer: { email: "me@example.com", self: true },
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

    await checkMailtoUrl(
      helper,
      0,
      "mailto:attendee@example.com?subject=Running late to meeting My test event"
    );

    await checkMailtoUrl(
      helper,
      1,
      "mailto:organizer@example.com?subject=Running late to meeting Your test event"
    );
  });
});

add_task(async function testRunningLateXss() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: `My XSS event" onclick="alert('hi')""`,
        attendees: [{ email: "uhoh@example.com", self: false }],
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

    await checkMailtoUrl(
      helper,
      0,
      `mailto:uhoh@example.com?subject=Running late to meeting My XSS event" onclick="alert('hi')""`
    );
  });
});

add_task(async function testNoAttendees() {
  await CompanionHelper.whenReady(async helper => {
    await helper.setCalendarEvents([
      {
        summary: "My personal event",
        organizer: { email: "me@example.com", self: true },
        creator: { self: true },
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
