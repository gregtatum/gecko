/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

ChromeUtils.defineModuleGetter(
  this,
  "Downloads",
  "resource://gre/modules/Downloads.jsm"
);

const TEST_URL =
  "http://example.com/browser/browser/components/companion/tests/browser/download.html";

let notificationsShown = win =>
  win.document.querySelectorAll("#companion-toast .toast-notification").length;

let currentCompanionView = async helper =>
  helper.runCompanionTask(
    () => content.document.getElementById("companion-deck").selectedViewName
  );

add_task(async function test_basic_downloads() {
  await SpecialPowers.pushPrefEnv({
    set: [["ui.prefersReducedMotion", 1]],
  });

  let win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });

  await CompanionHelper.whenReady(async helper => {
    let browser = win.gBrowser.selectedBrowser;
    BrowserTestUtils.loadURI(browser, TEST_URL);
    await BrowserTestUtils.browserLoaded(browser);

    let publicDownloads = await Downloads.getList(Downloads.PUBLIC);
    let downloadFinishedPromise = new Promise(resolve => {
      publicDownloads.addView({
        onDownloadChanged(download) {
          if (download.succeeded || download.error) {
            publicDownloads.removeView(this);
            publicDownloads.removeFinished();
            resolve(download);
          }
        },
      });
    });

    Assert.equal(0, notificationsShown(win), "Start with no notifications");

    await BrowserTestUtils.synthesizeMouseAtCenter("#download", {}, browser);

    // If we click on the notification before the download is complete, another
    // notification will be shown to signify it has finished downloading.
    await downloadFinishedPromise;
    await BrowserTestUtils.waitForCondition(
      () => notificationsShown(win),
      "The notification is shown when a download starts"
    );
    Assert.equal(1, notificationsShown(win), "A notification is shown");
    win.document.querySelector("#companion-toast .toast-notification").click();

    await BrowserTestUtils.waitForCondition(
      () => !notificationsShown(win),
      "The notification is hidden when clicked on"
    );

    Assert.equal(
      await currentCompanionView(helper),
      "downloads",
      "Clicking on the notification opens the downloads panel"
    );
    Assert.equal(
      0,
      notificationsShown(win),
      "Clicking on notification hides it"
    );
  }, win);
});

add_task(async function test_keyboard_open() {
  let win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });

  await CompanionHelper.whenReady(async helper => {
    let browser = win.gBrowser.selectedBrowser;
    BrowserTestUtils.loadURI(browser, TEST_URL);
    await BrowserTestUtils.browserLoaded(browser);

    Assert.equal(
      await currentCompanionView(helper),
      "now",
      "Companion is in browse tab by default"
    );

    helper.closeCompanion();

    let companionBrowser = win.document.getElementById("companion-browser");
    ok(
      BrowserTestUtils.is_hidden(companionBrowser),
      "Companion browser should be hidden"
    );

    if (AppConstants.platform == "linux") {
      EventUtils.synthesizeKey("y", { accelKey: true, shiftKey: true }, win);
    } else {
      EventUtils.synthesizeKey("j", { accelKey: true }, win);
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
      "downloads",
      "Companion has opened downloads panel"
    );
  }, win);
});
