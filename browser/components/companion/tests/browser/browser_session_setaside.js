/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.import(
  "resource:///modules/SessionManager.jsm"
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
      "https://example.com/"
    );
    await BrowserTestUtils.browserLoaded(
      win.gBrowser.selectedBrowser,
      false,
      "https://example.com/"
    );

    let sessionSetAside = SessionManager.once("session-set-aside");
    let sessionReplaced = SessionManager.once("session-replaced");
    win.document.getElementById("session-setaside-button").click();
    await sessionSetAside;

    // This should be set as soon as the session is set aside..
    Assert.ok(
      win.document.body.hasAttribute("flow-reset"),
      "Should have set the flow-reset attribute on the window"
    );

    await sessionReplaced;

    await BrowserTestUtils.waitForCondition(() => {
      return win.gBrowser.selectedBrowser.currentURI.spec == "about:flow-reset";
    });

    Assert.equal(
      win.gBrowser.selectedBrowser.currentURI.spec,
      "about:flow-reset",
      "Browser is showing the Reset Flow page"
    );

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

    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window: win,
      value: "http://example.com",
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
