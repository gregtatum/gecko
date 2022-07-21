/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

/* globals DEFAULT_FAKE_NOW_TS */

"use strict";

add_task(async function testPrefControlled() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", false]],
  });

  await CompanionHelper.whenReady(async helper => {
    await helper.reload();
    await helper.selectCompanionTab("browse");

    await helper.runCompanionTask(async () => {
      let calendarEntry = content.document.querySelector(".calendar");
      ok(
        ContentTaskUtils.is_hidden(calendarEntry),
        "Calendar option is not visible"
      );
    });
  });
});

add_task(async function testBrowseOpenBack() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Super simple event",
      },
    ];

    await checkEventInBrowseView(helper, events);
    await helper.runCompanionTask(async () => {
      let calendarEntry = content.document.querySelector(".calendar");
      let calendarPanel = content.document.querySelector(".calendar-panel");
      let { backButton } = calendarPanel;
      ok(ContentTaskUtils.is_visible(backButton), "Back button is visible");
      ok(ContentTaskUtils.is_hidden(calendarEntry), "Calendar button hidden");

      let panelHidden = ContentTaskUtils.waitForEvent(
        content.document.getElementById("companion-deck"),
        "view-changed"
      );
      backButton.click();
      await panelHidden;

      ok(ContentTaskUtils.is_hidden(backButton), "Back button hidden");
      ok(ContentTaskUtils.is_visible(calendarEntry), "Calendar button visible");
    });
  });
});

add_task(async function testEventInBrowseView() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS).valueOf();
    let today = new Date(now);
    today.setHours(0, 0, 0, 0);

    let yesterday = new Date(now);
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    let tomorrow = new Date(now);
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    let events = [];
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      0,
      30,
      yesterday
    );
    events.push({
      summary: "Meeting starting/ending yesterday",
      startDate: start,
      endDate: end,
    });

    start = new Date(yesterday.setHours(23, 0, 0, 0)).toISOString();
    end = new Date((today.valueOf() + now) / 2).toISOString();
    events.push({
      summary: "Meeting starting yesterday & ending today",
      startDate: start,
      endDate: end,
    });

    start = new Date((2 * today.valueOf() + now) / 3).toISOString();
    end = new Date((today.valueOf() + now) / 2).toISOString();
    events.push({
      summary: "Finished meeting",
      startDate: start,
      endDate: end,
    });

    start = new Date((today.valueOf() + 2 * now) / 3).toISOString();
    end = new Date((2 * now + tomorrow.valueOf()) / 3).toISOString();
    events.push({
      summary: "Happening meeting",
      startDate: start,
      endDate: end,
    });

    start = new Date((now + tomorrow.valueOf()) / 2).toISOString();
    end = new Date((now + 2 * tomorrow.valueOf()) / 3).toISOString();
    events.push({
      summary: "Future meeting",
      startDate: start,
      endDate: end,
    });

    ({ start, end } = PinebuildTestUtils.generateEventTimes(
      0,
      30,
      new Date(tomorrow.setHours(1, 0, 0, 0))
    ));
    events.push({
      summary: "Tomorrow meeting",
      startDate: start,
      endDate: end,
    });

    await helper.reload();
    await helper.overrideRelativeTime(now, 0);

    const EXPECTED_EVENT_COUNT = 4;
    await setBrowseCalendarEvents(helper, events, EXPECTED_EVENT_COUNT);

    await helper.runCompanionTask(
      async expectedCount => {
        let browseEventList = content.document.getElementById(
          "browse-event-list"
        );
        let viewEvents = browseEventList.shadowRoot.querySelectorAll(
          "calendar-event"
        );
        is(
          viewEvents.length,
          expectedCount,
          "Four events must be in the browse section"
        );
        let eventRelativeTimes = await Promise.all(
          [...viewEvents]
            .filter(e => e.status != "future")
            .map(async e =>
              ContentTaskUtils.waitForCondition(() => {
                return e.shadowRoot.querySelector("relative-time");
              })
            )
        );
        is(
          eventRelativeTimes.length,
          3,
          "One event doesn't have a relative-time"
        );
        let relativeTimeContents = eventRelativeTimes.map(relativeTime =>
          relativeTime.shadowRoot.querySelector(".event-relative-time")
        );

        let l10nIds = relativeTimeContents.map(content =>
          content.getAttribute("data-l10n-id")
        );

        is(l10nIds[0], "companion-event-finished", "An event is finished");
        is(l10nIds[1], "companion-event-finished", "An event is finished");
        ok(
          [
            "companion-happening-now",
            "companion-ending-soon",
            "companion-almost-over",
          ].includes(l10nIds[2]),
          "An event is happening now"
        );
      },
      [EXPECTED_EVENT_COUNT]
    );
  });
});

add_task(async function testEventsLoadInBrowse() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Browse loaded",
      },
    ];

    await helper.setCalendarEvents(events);

    await selectCalendarTab(helper);

    let eventShown = await helper.runCompanionTask(async () => {
      return ContentTaskUtils.waitForCondition(() => {
        let browseEventList = content.document.getElementById(
          "browse-event-list"
        );
        return !!browseEventList.renderRoot.querySelector("calendar-event");
      });
    });
    ok(eventShown, "Event was shown in browse");
  });
});

add_task(async function testMultiDayEventInBrowseView() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      48,
      30,
      now.getHours()
    );

    let events = [
      {
        summary: "Multi Day Meeting",
        startDate: start,
        endDate: end,
      },
    ];

    await checkEventInBrowseView(helper, events);
  });
});

add_task(async function testAllDayEventInBrowseView() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      12,
      30,
      now.getHours()
    );

    let events = [
      {
        summary: "12 Hour Meeting",
        startDate: start,
        endDate: end,
      },
    ];

    await checkEventInBrowseView(helper, events);
  });
});

add_task(async function testActionItemsDisabledInBrowseView() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      12,
      30,
      now.getHours()
    );

    let events = [
      {
        summary: "My Meeting",
        startDate: start,
        endDate: end,
      },
    ];

    await checkEventInBrowseView(helper, events);
    await checkMenuActionForBrowseEvent(
      helper,
      ".event-item-email-action",
      true
    );
    await checkMenuActionForBrowseEvent(
      helper,
      ".event-item-hide-action",
      true
    );
  });
});

add_task(async function testEmptyStateWithConnectedAccount() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    await helper.reload();
    await helper.createAccount();

    let events = [];
    await setBrowseCalendarEvents(helper, events);

    // Ensure accounts are loaded before checking the empty state message.
    await helper.loadAccountData();
    info("Empty message should indicate there are no events.");
    await checkEmptyCalendarMessage(helper, "companion-calendar-no-items");
  });
});

add_task(async function testEmptyStateWithoutConnectedAccount() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    await helper.reload();
    await selectCalendarTab(helper);

    // Clear workshop data to delete any accounts.
    await helper.clearAccountData();
    info("Empty message should indicate there are no connected accounts.");
    await checkEmptyCalendarMessage(helper, "companion-calendar-not-connected");
  });
});

add_task(async function testExpandableDetailsLinks() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    await helper.reload();
    let { start, end } = PinebuildTestUtils.generateEventTimes(0, 30);
    let events = [
      {
        summary: "My Meeting",
        startDate: start,
        endDate: end,
        organizer: {
          email: "test123@gmail.com",
        },
        links: [
          { url: "https://example.com/" },
          { url: "https://example.com/2" },
        ],
      },
    ];

    await setBrowseCalendarEvents(helper, events);
    await helper.runCompanionTask(async () => {
      let browseEventList = content.document.getElementById(
        "browse-event-list"
      );
      let event = browseEventList.shadowRoot.querySelector("calendar-event");

      info(
        "If the event isn't expanded, then we don't show additional details."
      );
      let eventLinksSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-links-wrapper");
      });
      ok(
        eventLinksSection,
        "Links and documents are rendered when card is collapsed."
      );

      info("Expand details");
      let eventCard = event.shadowRoot.querySelector(".event");
      const detailsToggled = ContentTaskUtils.waitForEvent(
        event,
        "toggle-details"
      );
      EventUtils.synthesizeMouseAtCenter(event.expandButton, {}, content);
      await detailsToggled;
      await event.updateComplete;

      info("Ensure action buttons are shown");
      let actionButtons = eventCard.querySelectorAll("action-button");
      is(actionButtons.length, 4, "The action buttons are rendered.");

      info("Ensure links are still shown");
      let meetingLinksSection = eventCard.querySelector(".event-links");
      ok(meetingLinksSection, "Meeting links are shown.");

      info("Host details are now shown");
      let hostDetailSection = eventCard.querySelector(".event-host");
      ok(hostDetailSection, "Host section is shown.");
    });
  });
});

add_task(async function testMessageAttendeesButton() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    await helper.reload();
    const ATTENDEE_EMAIL = "attendee@example.com";
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      0,
      30,
      now.getHours() - 1
    );
    let events = [
      {
        summary: "My Finished Meeting",
        startDate: start,
        endDate: end,
        attendees: [{ email: ATTENDEE_EMAIL, isSelf: false }],
        organizer: {
          email: "test123@gmail.com",
          isSelf: true,
        },
      },
    ];

    await setBrowseCalendarEvents(helper, events);
    await validateEmailButtonDetails(
      helper,
      "companion-message-attendees",
      `mailto:${ATTENDEE_EMAIL}`
    );
  });
});

add_task(async function testMessageHostButton() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    await helper.reload();
    const HOST_EMAIL = "host@example.com";
    let now = new Date(DEFAULT_FAKE_NOW_TS);
    let { start, end } = PinebuildTestUtils.generateEventTimes(
      0,
      30,
      now.getHours() - 1
    );
    let events = [
      {
        summary: "Your Finished Meeting",
        startDate: start,
        endDate: end,
        attendees: [
          { email: "test123@gmail.com", isSelf: true },
          { email: HOST_EMAIL, isSelf: true },
        ],
        organizer: {
          email: HOST_EMAIL,
          isSelf: false,
        },
      },
    ];

    await setBrowseCalendarEvents(helper, events);
    await validateEmailButtonDetails(
      helper,
      "companion-message-host",
      `mailto:${HOST_EMAIL}`
    );
  });
});

async function validateEmailButtonDetails(helper, expectedId, expectedUrl) {
  let openedUrl = helper.catchNextOpenedUrl();
  await helper.runCompanionTask(
    async l10nId => {
      let browseEventList = content.document.getElementById(
        "browse-event-list"
      );
      let visibleEvents = browseEventList.calendarEvents;
      let event = visibleEvents[0];

      info("Expand details");
      const detailsToggled = ContentTaskUtils.waitForEvent(
        event,
        "toggle-details"
      );
      EventUtils.synthesizeMouseAtCenter(event.expandButton, {}, content);
      await detailsToggled;
      await event.updateComplete;

      let emailButton = event.shadowRoot.querySelector(
        ".event-item-email-action"
      );
      ok(ContentTaskUtils.is_visible(emailButton), "Email button is visible");
      let emailButtonLabel = emailButton.shadowRoot.querySelector(
        ".action-button-label"
      );
      is(
        emailButtonLabel.getAttribute("data-l10n-id"),
        l10nId,
        "The expected label is used"
      );
      emailButton.click();
    },
    [expectedId]
  );
  let url = await openedUrl;
  is(url, expectedUrl, "Expected email URL was opened");
}

async function checkEmptyCalendarMessage(helper, messageId) {
  await helper.runCompanionTask(
    async message => {
      let browseEventList = content.document.getElementById(
        "browse-event-list"
      );
      let emptyCalendarMessage = browseEventList.shadowRoot.querySelector(
        ".calendar-empty-message"
      );
      ok(emptyCalendarMessage, "Empty calendar placeholder is shown.");
      is(
        emptyCalendarMessage.getAttribute("data-l10n-id"),
        message,
        "The correct empty state message is displayed."
      );
    },
    [messageId]
  );
}

async function checkEventInBrowseView(helper, events) {
  await helper.reload();
  await setBrowseCalendarEvents(helper, events);

  await helper.runCompanionTask(async () => {
    let browseEventList = content.document.getElementById("browse-event-list");
    let event = browseEventList.shadowRoot.querySelector("calendar-event");
    ok(event, "event is shown in the browse section.");
  });
}

async function selectCalendarTab(helper) {
  await helper.selectCompanionTab("browse");
  await helper.runCompanionTask(async () => {
    let calendarButton = content.document.querySelector(".calendar");
    let calendarShown = ContentTaskUtils.waitForEvent(
      content.document.getElementById("companion-deck"),
      "view-changed"
    );
    calendarButton.click();
    await calendarShown;
  });
}

// Ensure the browse view is open before setting events so that we can listen
// for "calendar-events-updated" on the browse calendar list view.
async function setBrowseCalendarEvents(helper, events, expectedEventCount) {
  await selectCalendarTab(helper);
  await helper.setCalendarEvents(events, {
    listType: "browse",
    expectedEventCount: expectedEventCount || events.length,
  });
}

async function checkMenuActionForBrowseEvent(
  helper,
  menuItemSelector,
  isDisabled
) {
  await helper.runCompanionTask(
    async (selector, shouldBeDisabled) => {
      let browseEventList = content.document.getElementById(
        "browse-event-list"
      );
      let visibleEvents = browseEventList.calendarEvents;
      let event = visibleEvents[0];

      info("Expand details");
      if (event.detailsCollapsed) {
        const detailsExpanded = Promise.all([
          ContentTaskUtils.waitForEvent(event, "toggle-details"),
          event.updateComplete,
        ]);
        EventUtils.synthesizeMouseAtCenter(event.expandButton, {}, content);
        await detailsExpanded;
      }

      let item = event.shadowRoot.querySelector(selector);
      is(
        item.disabled,
        shouldBeDisabled,
        `${selector} button is ${shouldBeDisabled ? "disabled" : "enabled"}`
      );
    },
    [menuItemSelector, isDisabled]
  );
}
