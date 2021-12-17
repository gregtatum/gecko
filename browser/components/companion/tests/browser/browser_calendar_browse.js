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
    await helper.reload();
    await helper.selectCompanionTab("browse");

    await helper.runCompanionTask(async () => {
      let calendarEntry = content.document.querySelector(".calendar");
      ok(
        ContentTaskUtils.is_visible(calendarEntry),
        "Calendar option is visible"
      );

      let calendarShown = ContentTaskUtils.waitForEvent(
        content.document,
        "browse-panel-shown"
      );
      calendarEntry.click();
      await calendarShown;

      let calendarPlaceholder = content.document.querySelector(
        ".calendar-panel .card"
      );
      ok(
        ContentTaskUtils.is_visible(calendarPlaceholder),
        "Placeholder is visible"
      );
      is(
        calendarPlaceholder.textContent,
        "Calendar Placeholder",
        "Placeholder has content"
      );

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
