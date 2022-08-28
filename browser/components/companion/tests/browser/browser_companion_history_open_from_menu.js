/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

let currentCompanionView = helper =>
  helper.runCompanionTask(
    () => content.document.getElementById("companion-deck").selectedViewName
  );

add_task(async function test_companion_history_open_from_menu() {
  let win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });

  await CompanionHelper.whenReady(async helper => {
    Assert.equal(
      await currentCompanionView(helper),
      "now",
      "Companion is in browse tab by default"
    );

    await helper.closeCompanion();

    let companionBrowser = win.document.getElementById("companion-browser");

    if (AppConstants.platform == "macosx") {
      EventUtils.synthesizeKey("y", { accelKey: true }, win);
    } else {
      EventUtils.synthesizeKey("h", { accelKey: true, shiftKey: true }, win);
    }

    await BrowserTestUtils.waitForCondition(
      () => !BrowserTestUtils.is_hidden(companionBrowser)
    );

    ok(
      !BrowserTestUtils.is_hidden(companionBrowser),
      "Companion browser should be visible"
    );

    Assert.equal(
      await currentCompanionView(helper),
      "history",
      "Companion has opened history panel"
    );
  }, win);
});
