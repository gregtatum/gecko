/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const DEFAULT_FAVICON_SRC = "chrome://global/skin/icons/defaultFavicon.svg";

/* Ensures that a calendar event with links is displayed in the companion */
add_task(async function testEventWithLinks() {
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

      let eventLinksSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-links");
      });
      let links = eventLinksSection.querySelectorAll("a");
      let favicon = links[0].querySelector("img").src;

      is(links.length, 2, "There are two links displayed.");
      is(
        favicon,
        "chrome://global/skin/icons/defaultFavicon.svg",
        "The default icon should be defaultFavicon.svg"
      );
    });
  });
});

/* Ensures that a calendar event with more than 3 links displayed a button for expanding
   the meeting links section */
add_task(async function testEventWithSeveralLinks() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox rules",
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
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");

      let eventLinksSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-links");
      });
      let links = eventLinksSection.querySelectorAll("a");
      let expandLinksButton = eventLinksSection.querySelector("button");

      is(links.length, 2, "There are only two links displayed.");
      ok(
        expandLinksButton,
        "There should a button for expanding the links section."
      );
      is(
        expandLinksButton.getAttribute("data-l10n-id"),
        "companion-expand-event-links-button",
        "Expand links button is localized"
      );

      info("Test clicking the button shows all event links");
      expandLinksButton.click();

      await event.updateComplete;
      is(
        eventLinksSection.querySelectorAll("a").length,
        4,
        "Event links section should show all links."
      );
    });
  });
});

add_task(async function testEventWithNoLinks() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox is cool",
      },
    ];

    await helper.setCalendarEvents(events);
    await helper.runCompanionTask(async () => {
      let calendarEventList = content.document.querySelector(
        "calendar-event-list"
      );
      let event = calendarEventList.shadowRoot.querySelector("calendar-event");
      let eventLinksSection = event.shadowRoot.querySelector(".event-links");
      ok(!eventLinksSection, "There should be no event-links section");
    });
  });
});

add_task(async function testEventLinksFocus() {
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
      let eventLinksSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-links");
      });

      info("Ensure focus is on the correct meeting link");
      let expandLinksButton = eventLinksSection.querySelector("button");

      ok(!event.shadowRoot.activeElement, "Focus not in calendar-event");
      expandLinksButton.focus();
      is(
        event.shadowRoot.activeElement,
        expandLinksButton,
        "Expand link is focused"
      );

      EventUtils.sendKey("space", content);
      await event.updateComplete;

      let links = eventLinksSection.querySelectorAll("a");
      is(event.shadowRoot.activeElement, links[2], "Third link is focused");
    });
  });
});
