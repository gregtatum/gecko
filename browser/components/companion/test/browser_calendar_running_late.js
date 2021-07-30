/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function testRunningLate() {
  await CompanionHelper.withCalendarReady(async helper => {
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
        organizer: { self: true },
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

      let event = visibleEvents[0];
      let mailtoLink = event.shadowRoot.querySelector('[href^="mailto:"]');
      ok(mailtoLink, "There's a link to mailto: the email");
      is(
        mailtoLink.href,
        "mailto:attendee@example.com?subject=Running late to meeting My test event",
        "The mailto link as organizer exists"
      );

      event = visibleEvents[1];
      mailtoLink = event.shadowRoot.querySelector('[href^="mailto:"]');
      ok(mailtoLink, "There's a link to mailto: the email");
      is(
        mailtoLink.href,
        "mailto:organizer@example.com?subject=Running late to meeting Your test event",
        "The mailto link for organizer exists"
      );
    });
  });
});

add_task(async function testRunningLateXss() {
  await CompanionHelper.withCalendarReady(async helper => {
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
      let event = visibleEvents[0];
      let mailtoLink = event.shadowRoot.querySelector('[href^="mailto:"]');
      ok(mailtoLink, "There's a link to mailto: the email");
      ok(
        mailtoLink.href.includes("onclick="),
        "The onclick was added to the href, not on its own"
      );
    });
  });
});

add_task(async function testNoAttendees() {
  await CompanionHelper.withCalendarReady(async helper => {
    await helper.setCalendarEvents([
      {
        summary: "My personal event",
        organizer: { self: true },
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
      let mailtoLink = event.shadowRoot.querySelector('[href^="mailto:"]');
      ok(!mailtoLink, "There's no mailto: link");
    });
  });
});
