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

function hasVisibilityHiddenSet(win, id) {
  let el = win.document.getElementById(id);
  return win.getComputedStyle(el).visibility == "hidden";
}

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

    let browserLoaded = BrowserTestUtils.browserLoaded(
      win.gBrowser.selectedBrowser
    );
    BrowserTestUtils.loadURI(
      win.gBrowser.selectedBrowser,
      "http://example.com"
    );
    await browserLoaded;

    let sessionReplaced = new Promise(resolve =>
      SessionManager.once("session-replaced", resolve)
    );
    win.document.getElementById("session-setaside-button").click();
    await sessionReplaced;

    Assert.equal(
      win.gBrowser.selectedBrowser.currentURI.spec,
      "about:flow-reset",
      "Browser is showing the Reset Flow page"
    );

    let currentView = await helper.runCompanionTask(
      () => content.document.getElementById("companion-deck").selectedViewName
    );
    Assert.equal(currentView, "now", "Companion has switched to now tab");

    Assert.ok(hasVisibilityHiddenSet(win, "pinebuild-back-button"));
    Assert.ok(hasVisibilityHiddenSet(win, "pinebuild-reload-button"));
    Assert.ok(hasVisibilityHiddenSet(win, "pinebuild-copy-button"));
    Assert.ok(hasVisibilityHiddenSet(win, "session-setaside-button"));

    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window: win,
      value: "http://example.com",
    });

    let element = await UrlbarTestUtils.waitForAutocompleteResultAt(win, 0);
    EventUtils.synthesizeMouseAtCenter(element, {}, win);

    await BrowserTestUtils.waitForCondition(() => {
      return !hasVisibilityHiddenSet(win, "pinebuild-back-button");
    });

    Assert.ok(!hasVisibilityHiddenSet(win, "pinebuild-back-button"));
    Assert.ok(!hasVisibilityHiddenSet(win, "pinebuild-reload-button"));
    Assert.ok(!hasVisibilityHiddenSet(win, "pinebuild-copy-button"));
    Assert.ok(!hasVisibilityHiddenSet(win, "session-setaside-button"));
  }, win);
});
