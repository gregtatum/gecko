/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { SessionManager } = ChromeUtils.import(
  "resource:///modules/SessionManager.jsm"
);

const { UrlbarProviderContextualSearch } = ChromeUtils.import(
  "resource:///modules/UrlbarProviderContextualSearch.jsm"
);

XPCOMUtils.defineLazyGetter(this, "UrlbarTestUtils", () => {
  const { UrlbarTestUtils: module } = ChromeUtils.import(
    "resource://testing-common/UrlbarTestUtils.jsm"
  );
  module.init(this);
  registerCleanupFunction(() => module.uninit());
  return module;
});

XPCOMUtils.defineLazyGetter(this, "SearchTestUtils", () => {
  const { SearchTestUtils: module } = ChromeUtils.import(
    "resource://testing-common/SearchTestUtils.jsm"
  );
  module.init(this);
  return module;
});

let engine;

add_task(async function init() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.urlbar.contextualSearch.enabled", true]],
  });

  engine = await SearchTestUtils.promiseNewSearchEngine(
    "chrome://mochitests/content/browser/browser/components/search/test/browser/testEngine.xml"
  );
});

add_task(async function test_selectContextualSearchResult() {
  let win = await BrowserTestUtils.openNewBrowserWindow();
  BrowserTestUtils.loadURI(
    win.gBrowser.selectedBrowser,
    "http://mochi.test:8888/"
  );
  await BrowserTestUtils.browserLoaded(win.gBrowser.selectedBrowser);

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });

  await CompanionHelper.whenReady(async () => {
    const query = "search";
    const [expectedUrl] = UrlbarUtils.getSearchQueryUrl(engine, query);

    ok(
      expectedUrl.includes(`?search&test=${query}`),
      "Expected URL should be a search URL"
    );

    await UrlbarTestUtils.promiseAutocompleteResultPopup({
      window: win,
      value: query,
    });
    const lastResultIndex = UrlbarTestUtils.getResultCount(win) - 1;
    const result = await UrlbarTestUtils.getDetailsOfResultAt(
      win,
      lastResultIndex
    );

    is(
      result.dynamicType,
      "contextualSearch",
      "Last result is a contextual search result"
    );

    info("Focus and select the contextual search result");
    UrlbarTestUtils.setSelectedRowIndex(win, lastResultIndex);
    EventUtils.synthesizeKey("KEY_Enter", {}, win);
    await BrowserTestUtils.browserLoaded(win.gBrowser.selectedBrowser);

    is(
      win.gBrowser.selectedBrowser.currentURI.spec,
      expectedUrl,
      "Selecting the contextual search result opens the search URL"
    );
  }, win);
});
