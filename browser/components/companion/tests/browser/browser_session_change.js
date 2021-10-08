/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.import(
  "resource:///modules/SessionManager.jsm"
);

add_task(async function test_session_change() {
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
      "https://example.com/"
    );
    await BrowserTestUtils.browserLoaded(
      win.gBrowser.selectedBrowser,
      false,
      "https://example.com/"
    );

    let sessionReplaced = SessionManager.once("session-replaced");
    let sessionSetAside = SessionManager.once("session-set-aside");
    let flowResetLoaded = BrowserTestUtils.waitForNewTab(
      win.gBrowser,
      "about:flow-reset",
      true
    );

    await SessionManager.replaceSession(win);
    await sessionSetAside;

    // This should be set as soon as the session is set aside..
    Assert.ok(
      win.document.body.hasAttribute("flow-reset"),
      "Should have set the flow-reset attribute on the window"
    );

    await sessionReplaced;

    let currentView = await helper.runCompanionTask(
      () => content.document.getElementById("companion-deck").selectedViewName
    );

    Assert.equal(currentView, "now");

    await flowResetLoaded;

    // Now switch back to the previous session.
    sessionReplaced = SessionManager.once("session-replaced");
    let sessionChangeStart = SessionManager.once("session-change-start");

    await SpecialPowers.spawn(
      win.gBrowser.selectedBrowser.browsingContext,
      [],
      async () => {
        content.document.getElementById("restore").click();
      }
    );

    await sessionChangeStart;
    // This should be cleared as soon as the session change happens.
    Assert.ok(
      !win.document.body.hasAttribute("flow-reset"),
      "Should have cleared the flow-reset attribute on the window"
    );
    await sessionReplaced;
  }, win);
});
