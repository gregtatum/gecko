/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function testExpandingEventDetails() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox rules",
        email: "test123@gmail.com",
        links: [
          { url: "https://example.com/" },
          { url: "https://example.com/2" },
        ],
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      let meetingLinksHeaderExists = () => {
        return !!event.shadowRoot.querySelector(
          ".event-detail-header[data-l10n-id=companion-event-document-and-links]"
        );
      };
      let hostHeaderExists = () => {
        return !!event.shadowRoot.querySelector(
          ".event-detail-header[data-l10n-id=companion-event-host]"
        );
      };

      info("Check that headers aren't shown in the first place.");
      ok(
        !meetingLinksHeaderExists(),
        "Meeting links detail header is not shown"
      );
      ok(!hostHeaderExists(), "Host detail header is not shown");

      info(
        "When an event is collapsed, check that an event with meeting links will show the links section instead of the host"
      );
      let eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });
      let hostDetailSection = eventDetailsSection.querySelector(".event-host");
      let meetingLinksSection = eventDetailsSection.querySelector(
        ".event-links"
      );
      ok(meetingLinksSection, "Meeting links are shown");
      ok(!hostDetailSection, "Host section isn't shown");

      info("Clicking the card should expand the details section.");
      EventUtils.sendMouseEvent(
        {
          type: "mousedown",
        },
        eventDetailsSection,
        content
      );
      await event.updateComplete;
      ok(meetingLinksHeaderExists(), "Meeting links detail header is shown");
      ok(hostHeaderExists(), "Host detail header is shown");

      info("Clicking the expanded card should collapse the details section.");
      eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });
      EventUtils.sendMouseEvent(
        {
          type: "mousedown",
        },
        eventDetailsSection,
        content
      );
      await event.updateComplete;
      ok(
        !meetingLinksHeaderExists(),
        "Meeting links detail header is not shown"
      );
    });
  });
});

add_task(async function testExpandingLinkDetailsWithKeyboard() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox is cool",
        links: [
          { url: "https://example.com/" },
          { url: "https://example.com/2" },
          { url: "https://example.com/3" },
          { url: "https://example.com/4" },
        ],
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      const EventUtils = ContentTaskUtils.getEventUtils(content);
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      let eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });
      let meetingLinksHeaderExists = () => {
        return !!event.shadowRoot.querySelector(
          ".event-detail-header[data-l10n-id=companion-event-document-and-links]"
        );
      };

      ok(
        !meetingLinksHeaderExists(),
        "Header for meeting links should not be showing in the first place."
      );

      info("Ensure focus is on the details sections.");
      ok(!event.shadowRoot.activeElement, "Focus not in calendar-event");
      eventDetailsSection.focus();

      is(
        event.shadowRoot.activeElement,
        eventDetailsSection,
        "Event details section is focused"
      );

      info("Expand the details section.");
      EventUtils.sendKey("space", content);
      await event.updateComplete;

      ok(
        meetingLinksHeaderExists(),
        "Header for meeting links should be showing"
      );

      info("Ensure focus is still on the detail section");
      eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });
      is(
        event.shadowRoot.activeElement,
        eventDetailsSection,
        "Event details section is still focused"
      );
    });
  });
});

add_task(async function testHostDetailsWithValidOrganizerEmail() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox rules",
        organizer: {
          email: "test123@gmail.com",
        },
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");

      info(
        "When an event is collapsed, check that an event with no meeting links will instead show the host section"
      );
      let eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });
      let hostDetailSection = eventDetailsSection.querySelector(".event-host");
      ok(hostDetailSection, "Host section is shown");

      info(
        "Ensure the host email is displayed if a display name isn't available"
      );
      let email = eventDetailsSection.querySelector(".event-host-email");
      is(email.textContent, "test123@gmail.com", "Email is displayed");

      info("Ensure correct host type is displayed");
      let hostType = eventDetailsSection.querySelector(".event-host-type");
      is(
        hostType.getAttribute("data-l10n-id"),
        "companion-event-organizer",
        "Host type should be 'organizer'"
      );
    });
  });
});

add_task(async function testHostDetailsWithSecondaryGCalOrganizerData() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox rules",
        organizer: {
          email: "auto-generated-test123@group.calendar.google.com",
        },
        creator: {
          email: "test123@gmail.com",
        },
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      info(
        "Ensure the host email is displayed is the creator's instead of the organizer"
      );
      let eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });
      let email = eventDetailsSection.querySelector(".event-host-email");
      is(email.textContent, "test123@gmail.com", "Creator email is displayed");

      info("Ensure correct host type is displayed");
      let hostType = eventDetailsSection.querySelector(".event-host-type");
      is(
        hostType.getAttribute("data-l10n-id"),
        "companion-event-creator",
        "Host type should be 'creator'"
      );
    });
  });
});

add_task(async function testHostDetailsDisplayName() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox rules",
        organizer: {
          email: "test123@gmail.com",
          displayName: "Test Account",
        },
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");

      info("Ensure the host name is displayed instead of the host type");
      let eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });
      let name = eventDetailsSection.querySelector(".event-host-name");
      let hostType = eventDetailsSection.querySelector(".event-host-type");
      is(name.textContent, "Test Account", "Host name is displayed");
      ok(!hostType, "Host type is not displayed");

      info("Ensure the email is displayed");
      let email = eventDetailsSection.querySelector(".event-host-email");
      is(email.textContent, "test123@gmail.com", "Email is shown");
    });
  });
});

add_task(async function testVisibilityOfHostSelf() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox rules",
        organizer: {
          email: "test123@gmail.com",
          displayName: "Test Account",
          isSelf: true,
        },
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");

      info("Ensure a self hosted event doesn't display in collapsed view.");
      let eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(
          ".event-details.event-details-none"
        );
      });
      let eventHost = eventDetailsSection.querySelector(".event-host");
      ok(!eventHost, "Event host is not displayed");
    });
  });
});

add_task(async function testSecondaryGCalWithNoCreatorAvailable() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox rules",
        organizer: {
          name: "Test secondary calendar",
          email: "auto-generated-test123@group.calendar.google.com",
        },
        creator: null,
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      let eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });

      info("Ensure the correct host name is displayed");
      let name = eventDetailsSection.querySelector(".event-host-name");
      ok(name, "Host name is displayed.");
      is(name.textContent, "Test secondary calendar", "Host name is correct.");

      info("Ensure correct host type is displayed");
      let hostType = eventDetailsSection.querySelector(".event-host-type");
      is(
        hostType.getAttribute("data-l10n-id"),
        "companion-event-organizer",
        "Host type should be 'organizer'"
      );

      info("Ensure the host email is not displayed");
      let email = eventDetailsSection.querySelector(".event-host-email");
      ok(!email, "No email is displayed");
    });
  });
});
