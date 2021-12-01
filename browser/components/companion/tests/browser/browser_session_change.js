/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.import(
  "resource:///modules/SessionManager.jsm"
);

add_task(async function test_session_change() {
  // Run test in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow();
  let setAsideBtn = win.document.getElementById("session-setaside-button");

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

    setAsideBtn.click();

    Assert.ok(
      setAsideBtn.hasAttribute("disabled"),
      "SetAside button is disabled"
    );
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

    let sessionReplaceCalls = 0;
    let countSessionReplaceCalls = () => sessionReplaceCalls++;
    SessionManager.on("session-replaced", countSessionReplaceCalls);

    await SpecialPowers.spawn(
      win.gBrowser.selectedBrowser.browsingContext,
      [],
      async () => {
        content.document.getElementById("restore").click();
        content.document.getElementById("restore").click();
      }
    );

    await sessionReplaced;

    await BrowserTestUtils.waitForCondition(
      () => !win.document.body.hasAttribute("flow-reset"),
      "Should clear the flow-reset attribute on the window"
    );
    Assert.equal(win.gURLBar.value, "", "URLBar should be empty");

    // setTimeout is to allow the failing condition to complete, it
    // will not cause intermittent failures.
    // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
    await new Promise(resolve => setTimeout(resolve, 100));
    SessionManager.off("session-replaced", countSessionReplaceCalls);
    Assert.equal(
      sessionReplaceCalls,
      1,
      "Session should only be replaced once"
    );
  }, win);
});
