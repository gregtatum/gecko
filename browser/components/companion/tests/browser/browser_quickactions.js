/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

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
        result.payload.results[0]?.key,
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

add_task(async function test_checkgmail() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    await SpecialPowers.pushPrefEnv({
      set: [
        [
          "browser.pinebuild.quickactions.testURL",
          "https://example.com/help?email={email}",
        ],
      ],
    });

    await CompanionHelper.whenReady(async helper => {
      const account = await helper.createAccount();

      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window: win,
        value: "gmail",
      });

      const result = await UrlbarTestUtils.getDetailsOfResultAt(win, 1);
      is(
        result.payload.results[0]?.key,
        "checkgmail",
        "checkgmail quick action is displayed."
      );

      await assertActionOpensUrl(
        `https://example.com/help?email=${encodeURIComponent(account.name)}`,
        win
      );
    }, win);
  });
});

add_task(async function test_connectedAccountNavigation() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    await SpecialPowers.pushPrefEnv({
      set: [
        [
          "browser.pinebuild.quickactions.testURL",
          "https://example.com/help?authuser={email}",
        ],
        [
          "browser.pinebuild.companion.test-services",
          JSON.stringify([
            {
              icon: "chrome://browser/content/companion/googleAccount.png",
              name: "Test service",
              services: "Test connected accounts",
              domains: ["www.example.com", "test2.example.com"],
              type: "testservice",
            },
          ]),
        ],
      ],
    });
    await CompanionHelper.whenReady(async helper => {
      const account = await helper.createAccount();

      info("Bring up createdoc quick action.");
      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window: win,
        value: "document",
      });

      info("Validate account details included in URL on navigation.");
      await assertActionOpensUrl(
        `https://example.com/help?authuser=${encodeURIComponent(account.name)}`,
        win
      );
    }, win);
  });
});
