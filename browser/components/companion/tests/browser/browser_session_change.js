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

    let [view1, view2, view3, view4] = await PinebuildTestUtils.loadViews(
      [
        "https://example.com/",
        "https://example.com/browser/browser",
        "https://example.org/browser",
        "https://example.org/browser/browser/components",
      ],
      win
    );

    // This should result in 2 ViewGroups being created - 1 for the
    // example.com Views, and 1 for example.org Views.
    let groups = await PinebuildTestUtils.getViewGroups(win);
    Assert.equal(groups.length, 2, "There should be 2 ViewGroups.");
    Assert.deepEqual([...groups[0].viewGroup], [view1, view2]);
    Assert.deepEqual([...groups[1].viewGroup], [view3, view4]);

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
    let riverRebuilt = BrowserTestUtils.waitForEvent(
      win.gStageManager,
      "RiverRebuilt"
    );

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
    await riverRebuilt;

    await BrowserTestUtils.waitForCondition(
      () => !win.document.body.hasAttribute("flow-reset"),
      "Should clear the flow-reset attribute on the window"
    );
    Assert.equal(win.gURLBar.value, "", "URLBar should be empty");

    // We should have the same number of Views as before.
    let views = win.gStageManager.views;
    Assert.equal(
      views.length,
      4,
      "Expected 4 Views after restoring the session."
    );
    [view1, view2, view3, view4] = views;

    // We should get back the same number of ViewGroups as before.
    groups = await PinebuildTestUtils.getViewGroups(win);
    Assert.equal(groups.length, 2, "There should be 2 ViewGroups.");
    Assert.deepEqual([...groups[0].viewGroup], [view1, view2]);
    Assert.deepEqual([...groups[1].viewGroup], [view3, view4]);

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
