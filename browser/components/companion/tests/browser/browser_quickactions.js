/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.import(
  "resource:///modules/SessionManager.jsm"
);

const { UrlbarProviderQuickActionsFilter } = ChromeUtils.import(
  "resource:///modules/UrlbarProviderQuickActions.jsm"
);

XPCOMUtils.defineLazyGetter(this, "UrlbarTestUtils", () => {
  const { UrlbarTestUtils: module } = ChromeUtils.import(
    "resource://testing-common/UrlbarTestUtils.jsm"
  );
  module.init(this);
  registerCleanupFunction(() => module.uninit());
  return module;
});

add_task(async function test_basic() {
  // Run test in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });

  await CompanionHelper.whenReady(async helper => {
    UrlbarProviderQuickActionsFilter.addAction("test", {
      title: "Test Action",
      label: "testing",
      icon: "chrome://global/skin/icons/settings.svg",
      url: "about:blank",
    });

    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window: win,
      value: "test",
    });

    EventUtils.synthesizeKey("KEY_ArrowDown", {}, win);
    EventUtils.synthesizeKey("KEY_Enter", {}, win);
    is(win.gBrowser.currentURI.spec, "about:blank", "Opened about:blank");
  }, win);
});
