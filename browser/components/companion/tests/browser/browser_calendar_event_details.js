/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_task(async function testExpandingLinkDetails() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox rules",
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

      info("Check that meeting links header aren't shown in the first place.");
      ok(
        !meetingLinksHeaderExists(),
        "Meeting links detail header is not shown"
      );

      info("Clicking the card should expand the details section.");
      let eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });
      eventDetailsSection.click();
      await event.updateComplete;
      ok(meetingLinksHeaderExists(), "Meeting links detail header is shown");

      info("Clicking the expanded card should collapse the details section.");
      eventDetailsSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-details");
      });
      eventDetailsSection.click();
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
