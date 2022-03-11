/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

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
        content.document,
        "browse-panel-hidden"
      );
      backButton.click();
      await panelHidden;

      ok(ContentTaskUtils.is_hidden(backButton), "Back button hidden");
      ok(ContentTaskUtils.is_visible(calendarEntry), "Calendar button visible");
    });
  });
});

add_task(async function testMultiDayEventInBrowseView() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.calendar.browseEnabled", true]],
  });

  await CompanionHelper.whenReady(async helper => {
    let now = new Date();
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
    let now = new Date();
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

async function checkEventInBrowseView(helper, events) {
  await helper.reload();
  await helper.setCalendarEvents(events);
  await helper.selectCompanionTab("browse");

  await helper.runCompanionTask(async () => {
    let calendarButton = content.document.querySelector(".calendar");
    let calendarShown = ContentTaskUtils.waitForEvent(
      content.document,
      "browse-panel-shown"
    );
    calendarButton.click();
    await calendarShown;

    let browseEventList = content.document.getElementById("browse-event-list");
    let event = browseEventList.shadowRoot.querySelector("calendar-event");
    ok(event, "event is shown in the browse section.");
  });
}
