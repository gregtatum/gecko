/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const DEFAULT_FAVICON_SRC = "chrome://global/skin/icons/defaultFavicon.svg";

/* Ensures that a calendar event with links is displayed in the companion */
add_task(async function testEventWithLinks() {
  await CompanionHelper.withCalendarReady(async helper => {
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

add_task(async function testEventWithNoLinks() {
  await CompanionHelper.withCalendarReady(async helper => {
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

      let eventLinksSection = await ContentTaskUtils.waitForCondition(() => {
        return event.shadowRoot.querySelector(".event-links");
      });

      ok(
        eventLinksSection.hidden,
        "Event with no links should hide links section"
      );
    });
  });
});
