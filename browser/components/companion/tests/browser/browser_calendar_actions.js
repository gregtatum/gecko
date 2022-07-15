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
      if (event.detailsCollapsed) {
        info("Expand the event so the action buttons are visible");
        const detailsToggled = ContentTaskUtils.waitForEvent(
          event,
          "toggle-details"
        );
        EventUtils.synthesizeMouseAtCenter(event.expandButton, {}, content);
        await detailsToggled;
        await event.updateComplete;
      }
      let actionButton = event.shadowRoot.querySelector(selector);
      ok(actionButton, "Action button is rendered");
      actionButton.click();
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

    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      is(visibleEvents.length, 2, "There are now 2 events");

      let event = visibleEvents[0];
      info("Expand the event so the action buttons are visible");
      const detailsToggled = ContentTaskUtils.waitForEvent(
        event,
        "toggle-details"
      );
      EventUtils.synthesizeMouseAtCenter(event.expandButton, {}, content);
      await detailsToggled;
      await event.updateComplete;

      let runningLateButtonLabel = event.shadowRoot
        .querySelector(".event-item-email-action")
        .shadowRoot.querySelector(".action-button-label");
      is(
        runningLateButtonLabel.getAttribute("data-l10n-id"),
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
      ok(!runningLateButton, "The running late button is hidden");
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
      ok(!runningLateButton, "The running late button is hidden");
    });
  });
});

add_task(async function testHideEvent() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  async function createTestEvents(helper, expectedEventCount) {
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let eventTime = PinebuildTestUtils.generateEventTimes(0, 30, now);
    let nextStart = new Date(eventTime.end);
    nextStart.setMinutes(nextStart.getMinutes() + 10);
    let nextEventTime = PinebuildTestUtils.generateEventTimes(0, 30, nextStart);
    await helper.setCalendarEvents(
      [
        {
          id: "test-hide-event-1",
          summary: "Test Event",
          start: eventTime.start,
          end: eventTime.end,
        },
        {
          id: "test-hide-event-2",
          summary: "Next Event",
          start: nextEventTime.start,
          end: nextEventTime.end,
        },
      ],
      { expectedEventCount }
    );
  }

  async function assertVisibleEvents({ helper, section, hasHidden }) {
    await helper.runCompanionTask(
      async (_section, _hasHidden) => {
        let calendarEventList = content.document.querySelector(
          `calendar-event-list[listtype="${_section}"]`
        );
        if (_section == "browse") {
          await ContentTaskUtils.waitForCondition(
            () => calendarEventList.calendarEvents.length === 2
          );
          let breakTime = calendarEventList.renderRoot.querySelector(
            ".calendar-break-time"
          );
          ok(
            !ContentTaskUtils.is_hidden(calendarEventList.calendarEvents[1]),
            "Event is visible in browse"
          );
          ok(
            !ContentTaskUtils.is_hidden(breakTime),
            "Break time is visible in browse"
          );
        } else if (_hasHidden) {
          let breakTime = calendarEventList.renderRoot.querySelector(
            ".calendar-break-time"
          );
          is(calendarEventList.calendarEvents.length, 1, "Only one event");
          ok(!calendarEventList.calendarEvents[1], "Event is not rendered");
          ok(!breakTime, "Break time is not rendered");
        } else {
          is(calendarEventList.calendarEvents.length, 2, "There are 2 events");
          let calendarEventListChildren = calendarEventList.renderRoot.querySelectorAll(
            "calendar-event, .calendar-break-time"
          );
          is(
            calendarEventListChildren[0].localName,
            "calendar-event",
            "First child is a calendar event"
          );
          ok(
            calendarEventListChildren[1].classList.contains(
              "calendar-break-time"
            ),
            "Second child is a break time"
          );
          is(
            calendarEventListChildren[2].localName,
            "calendar-event",
            "Third child is a calendar event"
          );
        }
      },
      [section, hasHidden]
    );
  }

  async function openBrowse(helper) {
    await helper.selectCompanionTab("browse");

    await helper.runCompanionTask(async () => {
      let calendarButton = content.document.querySelector(".calendar");
      let calendarShown = ContentTaskUtils.waitForEvent(
        content.document.getElementById("companion-deck"),
        "view-changed"
      );
      calendarButton.click();
      await calendarShown;

      await ContentTaskUtils.waitForCondition(() => {
        return content.document.getElementById("browse-event-list");
      });
    });
  }

  await CompanionHelper.whenReady(async helper => {
    await createTestEvents(helper, 2);

    await assertVisibleEvents({ helper, section: "now", hasHidden: false });

    await helper.runCompanionTask(async () => {
      info("Expand the event so the action buttons are visible");
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.calendarEvents[1];
      const detailsToggled = ContentTaskUtils.waitForEvent(
        event,
        "toggle-details"
      );
      EventUtils.synthesizeMouseAtCenter(event.expandButton, {}, content);
      await detailsToggled;
      await event.updateComplete;

      info("Hide an event");
      let hideEventButton = event.shadowRoot.querySelector(
        ".event-item-hide-action"
      );
      ok(!hideEventButton.hidden, "Hide event button is visible");
      ok(event, "Event is rendered");
      let eventListUpdated = ContentTaskUtils.waitForEvent(
        calendarEventList,
        "calendar-events-updated"
      );
      hideEventButton.click();
      await event.updateComplete;
      await eventListUpdated;
    });

    info("Confirm event and break time are hidden when action is selected.");
    await assertVisibleEvents({ helper, section: "now", hasHidden: true });

    info("Check event and break time are still visible in browse");
    await helper.reload();
    await openBrowse(helper);

    await assertVisibleEvents({ helper, section: "browse" });

    info("Cleanup");
    await helper.reload();
  });

  info("Check event is hidden in new window");
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    await CompanionHelper.whenReady(async helper => {
      info("create events");
      await createTestEvents(helper, 1);
      info("assert hidden");
      await assertVisibleEvents({ helper, section: "now", hasHidden: true });
      info("open browse");
      await openBrowse(helper);
      info("assert visible");
      await assertVisibleEvents({ helper, section: "browse" });

      helper.clearDismissedEvents();
    }, win);
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

      info("Expand the event so the action buttons are visible");
      const detailsToggled = ContentTaskUtils.waitForEvent(
        event,
        "toggle-details"
      );
      EventUtils.synthesizeMouseAtCenter(event.expandButton, {}, content);
      await detailsToggled;
      await event.updateComplete;

      info("Confirm event link is copied to clipboard");
      let copyInviteButton = event.shadowRoot.querySelector(
        ".event-item-copy-invite-action"
      );
      ok(!copyInviteButton.hidden, "Copy invite button is visible");
      let inviteCopied = ContentTaskUtils.waitForEvent(
        content.document,
        "event-invite-copied"
      );
      copyInviteButton.click();
      await inviteCopied;

      let copiedLink = await content.navigator.clipboard.readText();
      is(copiedLink, "http://meet.google.com/join", "Invite link was copied");
    });
  });
});
