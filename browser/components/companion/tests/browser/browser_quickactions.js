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

async function validateQuickAction(action) {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    await SpecialPowers.pushPrefEnv({
      set: [["browser.pinebuild.quickactions.testURL", action.url]],
    });
    await CompanionHelper.whenReady(async helper => {
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window: win,
        value: action.command,
      });

      const result = await UrlbarTestUtils.getDetailsOfResultAt(win, 1);
      is(
        result.dynamicType,
        "quickActions",
        "Second Urlbar result is a quick action."
      );

      is(
        result.payload.results[0],
        action.type,
        `${action.type} quick action is displayed.`
      );

      await assertActionOpensUrl(action.url, win);
    }, win);
  });
}

async function assertActionOpensUrl(url, win) {
  EventUtils.synthesizeKey("KEY_ArrowDown", {}, win);
  EventUtils.synthesizeKey("KEY_Enter", {}, win);
  await BrowserTestUtils.browserLoaded(win.gBrowser.selectedBrowser);
  is(win.gBrowser.currentURI.spec, url, `Opened ${url}`);
}

add_task(async function test_basic() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
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

      await assertActionOpensUrl("about:blank", win);
    }, win);
  });
});

add_task(async function test_createmeeting() {
  const action = {
    type: "createmeeting",
    command: "calendar",
    url: "https://example.com/new-meeting",
  };

  await validateQuickAction(action);
});

add_task(async function test_createslides() {
  const action = {
    type: "createslides",
    command: "slides",
    url: "https://example.com/slides",
  };

  await validateQuickAction(action);
});

add_task(async function test_createsheet() {
  const action = {
    type: "createsheet",
    command: "spreadsheet",
    url: "https://example.com/spreadsheet",
  };

  await validateQuickAction(action);
});

add_task(async function test_createdoc() {
  const action = {
    type: "createdoc",
    command: "document",
    url: "https://example.com/document",
  };

  await validateQuickAction(action);
});
