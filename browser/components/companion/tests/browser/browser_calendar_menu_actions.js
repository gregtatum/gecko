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

      let event = visibleEvents[0];
      let runningLateButton = event.shadowRoot.querySelector(
        ".event-item-email-action"
      );
      is(
        runningLateButton.getAttribute("data-l10n-id"),
        "companion-email-late",
        "The 'Running late' label is used"
      );
    });

    await checkOpenedUrl(
      helper,
      "mailto:attendee@example.com?subject=Running late to meeting My test event",
      ".event-item-email-action"
    );

    await checkOpenedUrl(
      helper,
      "mailto:organizer@example.com?subject=Running late to meeting Your test event",
      ".event-item-email-action",
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
      ".event-item-email-action"
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
        ".event-item-email-action"
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
        ".event-item-email-action"
      );
      ok(runningLateButton.hidden, "The running late button is hidden");
    });
  });
});

add_task(async function testHideEvent() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let eventTime = PinebuildTestUtils.generateEventTimes(0, 30, now);
    let nextStart = new Date(eventTime.end);
    nextStart.setMinutes(nextStart.getMinutes() + 10);
    let nextEventTime = PinebuildTestUtils.generateEventTimes(0, 30, nextStart);

    await helper.setCalendarEvents([
      {
        summary: "Test Event",
        start: eventTime.start,
        end: eventTime.end,
      },
      {
        summary: "Next Event",
        start: nextEventTime.start,
        end: nextEventTime.end,
      },
    ]);

    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      is(visibleEvents.length, 2, "There's 2 events");
      let event = visibleEvents[1];
      let breakTime = calendarEventList.shadowRoot.querySelector(
        ".calendar-break-time"
      );

      info("Open meatball menu");
      let openMenuButton = event.shadowRoot.querySelector(
        ".event-options-button"
      );
      let panelMenu = event.shadowRoot.querySelector("panel-list");
      const EventUtils = ContentTaskUtils.getEventUtils(content);
      EventUtils.synthesizeMouseAtCenter(openMenuButton, {}, content);
      await ContentTaskUtils.waitForEvent(panelMenu, "shown");

      info("Confirm event and break time are hidden when action is selected.");
      let hideEventButton = event.shadowRoot.querySelector(
        ".event-item-hide-action"
      );
      ok(!hideEventButton.hidden, "Hide event button is visible");
      ok(event, "Event is rendered");
      hideEventButton.click();
      await event.updateComplete;
      breakTime = calendarEventList.shadowRoot.querySelector(
        ".calendar-break-time"
      );
      visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      ok(!visibleEvents[1], "Event is not rendered");
      ok(!breakTime, "Break time is not rendered");
    });

    info("Check event and break time are still visible in browse");
    await helper.reload();
    await helper.selectCompanionTab("browse");

    await helper.runCompanionTask(async () => {
      let calendarButton = content.document.querySelector(".calendar");
      let calendarShown = ContentTaskUtils.waitForEvent(
        content.document.getElementById("companion-deck"),
        "view-changed"
      );
      calendarButton.click();
      await calendarShown;

      let browseEventList = await ContentTaskUtils.waitForCondition(() => {
        return content.document.getElementById("browse-event-list");
      });
      await ContentTaskUtils.waitForCondition(() => {
        return (
          browseEventList.shadowRoot.querySelectorAll("calendar-event")
            .length === 2
        );
      });
      let browseEvents = browseEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      let browseBreakTime = browseEventList.shadowRoot.querySelector(
        ".calendar-break-time"
      );
      ok(
        !ContentTaskUtils.is_hidden(browseEvents[1]),
        "Event is visible in browse"
      );
      ok(
        !ContentTaskUtils.is_hidden(browseBreakTime),
        "Break time is visible in browse"
      );
    });

    info("Cleanup");
    await helper.reload();
  });
});

add_task(async function testCopyInvite() {
  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);

    // generate start and end times for event starting in one minute.
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      0,
      30,
      now.getHours(),
      now.getMinutes() + 1
    );

    let events = [
      {
        summary: "My Meeting",
        location: "http://meet.google.com/join",
        start,
        end,
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");

      info("Open meatball menu");
      let openMenuButton = event.shadowRoot.querySelector(
        ".event-options-button"
      );
      let panelMenu = event.shadowRoot.querySelector("panel-list");
      const EventUtils = ContentTaskUtils.getEventUtils(content);
      EventUtils.synthesizeMouseAtCenter(openMenuButton, {}, content);
      await ContentTaskUtils.waitForEvent(panelMenu, "shown");

      info("Confirm event link is copied to clipboard");
      let copyInviteButton = event.shadowRoot.querySelector(
        ".event-item-copy-invite-action"
      );
      ok(!copyInviteButton.hidden, "Copy invite button is visible");
      copyInviteButton.click();
      await ContentTaskUtils.waitForEvent(
        content.document,
        "event-invite-copied"
      );

      let copiedLink = await content.navigator.clipboard.readText();
      is(copiedLink, "http://meet.google.com/join", "Invite link was copied");
    });
  });
});
