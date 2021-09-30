/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.import(
  "resource:///modules/SessionManager.jsm"
);

add_task(async function setup() {
  // Run test in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });

  await CompanionHelper.whenReady(async helper => {
    await helper.runCompanionTask(
      () =>
        (content.document.getElementById("companion-deck").selectedViewName =
          "browse")
    );

    BrowserTestUtils.loadURI(
      win.gBrowser.selectedBrowser,
      "http://example.com"
    );
    await BrowserTestUtils.browserLoaded(win.gBrowser.selectedBrowser);

    let sessionReplaced = new Promise(resolve =>
      SessionManager.once("session-replaced", resolve)
    );

    await SessionManager.replaceSession(win);

    await sessionReplaced;

    let currentView = await helper.runCompanionTask(
      () => content.document.getElementById("companion-deck").selectedViewName
    );

    Assert.equal(currentView, "now");
  }, win);
});
