/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/* Ensures that a calendar event with links is displayed in the companion */
add_task(async function testEventWithLinks() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "Firefox rules",
        links: [
          { url: "https://example.com/1" },
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
        return event.shadowRoot.querySelector(".event-links-wrapper");
      });
      let links = eventLinksSection.querySelectorAll("a");

      is(links.length, 2, "There are two links displayed.");

      let text = [...links].map(link => link.innerText);
      Assert.deepEqual(
        text,
        ["https://example.com/1", "https://example.com/2"],
        "The text content must be the urls themselves."
      );

      let expandLinksButton = eventLinksSection.querySelector("button");
      ok(!expandLinksButton, "There is no expand links button");
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
        return event.shadowRoot.querySelector(".event-links-wrapper");
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
      is(
        expandLinksButton.getAttribute("data-l10n-id"),
        "companion-collapse-event-links-button",
        "Collapse links button is localized"
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
        return event.shadowRoot.querySelector(".event-links-wrapper");
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

      is(
        event.shadowRoot.activeElement,
        expandLinksButton,
        "Expand button stays focused"
      );

      let links = eventLinksSection.querySelectorAll("a");
      is(links.length, 4, "All links are now shown");

      EventUtils.sendKey("space", content);
      await event.updateComplete;

      links = eventLinksSection.querySelectorAll("a");
      is(links.length, 2, "Links are collapsed again");
    });
  });
});

add_task(async function testMultiEventLinkExpansion() {
  await CompanionHelper.whenReady(async helper => {
    let events = [
      {
        summary: "First Event",
        links: [
          { url: "https://example.com/" },
          { url: "https://example.com/2" },
          { url: "https://example.com/3" },
          { url: "https://example.com/4" },
        ],
      },
      {
        summary: "Second Event",
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
      let visibleEvents = calendarEventList.shadowRoot.querySelectorAll(
        "calendar-event"
      );
      let [firstEvent, secondEvent] = visibleEvents;

      const getEventLinks = event =>
        event.shadowRoot.querySelectorAll("a.event-link");

      info("Only two links are visible for each event initially");
      is(getEventLinks(firstEvent).length, 2, "First event has 2 links");
      is(getEventLinks(secondEvent).length, 2, "Second event has 2 links");

      info("Click on the first event to expand its links");
      const firstExpanded = ContentTaskUtils.waitForEvent(
        firstEvent,
        "toggle-details"
      );
      EventUtils.synthesizeMouseAtCenter(firstEvent.expandButton, {}, content);
      await firstExpanded;
      await firstEvent.updateComplete;

      is(getEventLinks(firstEvent).length, 4, "First event now has 4 links");
      is(getEventLinks(secondEvent).length, 2, "Second event only has 2 links");

      info(
        "Click on the second event to expand its links and hide the first event's extra links"
      );
      const secondExpanded = ContentTaskUtils.waitForEvent(
        secondEvent,
        "toggle-details"
      );
      EventUtils.synthesizeMouseAtCenter(secondEvent.expandButton, {}, content);
      await secondExpanded;
      await secondEvent.updateComplete;

      is(getEventLinks(firstEvent).length, 2, "First event now has 2 links");
      is(getEventLinks(secondEvent).length, 4, "Second event now has 4 links");
    });
  });
});
