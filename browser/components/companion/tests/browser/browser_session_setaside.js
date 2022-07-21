/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.importESModule(
  "resource:///modules/SessionManager.sys.mjs"
);

XPCOMUtils.defineLazyGetter(this, "UrlbarTestUtils", () => {
  const { UrlbarTestUtils: module } = ChromeUtils.import(
    "resource://testing-common/UrlbarTestUtils.jsm"
  );
  module.init(this);
  registerCleanupFunction(() => module.uninit());
  return module;
});

let isHidden = (win, id) =>
  BrowserTestUtils.is_hidden(win.document.getElementById(id));

let waitForSessions = async (helper, parent) => {
  let sessionsLength = async () => {
    let length = await helper.runCompanionTask(
      wrapper =>
        content.document.querySelectorAll(`${wrapper} .session`).length,
      [parent]
    );
    return length;
  };
  await TestUtils.waitForCondition(sessionsLength);
  return sessionsLength();
};

let titleHidden = async helper =>
  helper.runCompanionTask(
    () => content.document.querySelector("last-session-list .list-title").hidden
  );

add_setup(async () => {
  // Ensure all sessions are deleted.
  await PlacesUtils.withConnectionWrapper("delete", async db => {
    await db.execute(`DELETE FROM moz_session_metadata`);
  });
});

add_task(async function test_session_setaside() {
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

    Assert.ok(await titleHidden(helper), "Last Session title is not shown");

    let sessionSetAside = SessionManager.once("session-set-aside");
    let sessionReplaced = SessionManager.once("session-replaced");
    let flowResetLoaded = BrowserTestUtils.waitForNewTab(
      win.gBrowser,
      "about:flow-reset",
      true
    );
    win.document.getElementById("session-setaside-button").click();
    await sessionSetAside;

    // This should be set as soon as the session is set aside..
    Assert.ok(
      win.document.body.hasAttribute("flow-reset"),
      "Should have set the flow-reset attribute on the window"
    );

    await sessionReplaced;
    await flowResetLoaded;

    let currentView = await helper.runCompanionTask(
      () => content.document.getElementById("companion-deck").selectedViewName
    );
    Assert.equal(currentView, "now", "Companion has switched to now tab");

    Assert.ok(isHidden(win, "pinebuild-back-button"), "Back button hidden");
    Assert.ok(isHidden(win, "pinebuild-reload-button"), "Reload button hidden");
    Assert.ok(
      isHidden(win, "session-setaside-button"),
      "Setaside button hidden"
    );
    Assert.ok(
      BrowserTestUtils.is_hidden(
        win.document.querySelector("active-view-manager")
      ),
      "Active View Manager hidden"
    );

    await TestUtils.waitForCondition(
      () => win.document.activeElement === win.gURLBar.inputField
    );
    Assert.ok(true, "URLBar is focused when flow-reset page loads");

    // Test that the session is shown in the companion.
    await helper.selectCompanionTab("browse");
    Assert.equal(
      await waitForSessions(helper, "last-session-list"),
      1,
      "The session is shown in last session list"
    );
    Assert.ok(!(await titleHidden(helper)), "Last Session title is shown");

    await helper.runCompanionTask(() =>
      content.document.querySelector("button.sessions").click()
    );
    Assert.equal(
      await waitForSessions(helper, "full-session-list"),
      1,
      "The session is shown in full session list"
    );

    // Navigate to an about: page to test that the reset flow state
    // is still exited on navigation.
    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window: win,
      value: "about:config",
    });

    let element = await UrlbarTestUtils.waitForAutocompleteResultAt(win, 0);
    EventUtils.synthesizeMouseAtCenter(element, {}, win);

    await BrowserTestUtils.waitForCondition(
      () => !isHidden(win, "pinebuild-reload-button")
    );
    Assert.ok(!isHidden(win, "pinebuild-back-button"), "Back button shown");
    Assert.ok(!isHidden(win, "pinebuild-reload-button"), "Reload button shown");
    Assert.ok(
      !isHidden(win, "session-setaside-button"),
      "Setaside button shown"
    );
  }, win);
});
