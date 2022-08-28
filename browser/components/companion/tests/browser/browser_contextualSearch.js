/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

const { UrlbarProviderContextualSearch } = ChromeUtils.importESModule(
  "resource:///modules/UrlbarProviderContextualSearch.sys.mjs"
);

XPCOMUtils.defineLazyGetter(this, "UrlbarTestUtils", () => {
  const { UrlbarTestUtils: module } = ChromeUtils.importESModule(
    "resource://testing-common/UrlbarTestUtils.sys.mjs"
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

add_task(async function init() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.urlbar.contextualSearch.enabled", true]],
  });
});

add_task(async function test_selectContextualSearchResult_already_installed() {
  await SearchTestUtils.installSearchExtension({
    name: "Contextual",
    search_url: "https://example.com/browser",
  });

  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    const ENGINE_TEST_URL = "https://example.com/";
    BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, ENGINE_TEST_URL);
    await BrowserTestUtils.browserLoaded(
      win.gBrowser.selectedBrowser,
      false,
      ENGINE_TEST_URL
    );

    await CompanionHelper.whenReady(async () => {
      const query = "search";
      let engine = Services.search.getEngineByName("Contextual");
      const [expectedUrl] = UrlbarUtils.getSearchQueryUrl(engine, query);

      Assert.ok(
        expectedUrl.includes(`?q=${query}`),
        "Expected URL should be a search URL"
      );

      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window: win,
        value: query,
      });
      const resultIndex = UrlbarTestUtils.getResultCount(win) - 2;
      const result = await UrlbarTestUtils.getDetailsOfResultAt(
        win,
        resultIndex
      );

      is(
        result.dynamicType,
        "contextualSearch",
        "Second last result is a contextual search result"
      );

      info("Focus and select the contextual search result");
      UrlbarTestUtils.setSelectedRowIndex(win, resultIndex);
      EventUtils.synthesizeKey("KEY_Enter", {}, win);
      await BrowserTestUtils.browserLoaded(win.gBrowser.selectedBrowser);

      Assert.equal(
        win.gBrowser.selectedBrowser.currentURI.spec,
        expectedUrl,
        "Selecting the contextual search result opens the search URL"
      );
    }, win);
  });
});

add_task(async function test_selectContextualSearchResult_not_installed() {
  await PinebuildTestUtils.withNewBrowserWindow(async win => {
    // Note: The hostname used here must be different to the previous test.
    const ENGINE_TEST_URL =
      "http://mochi.test:8888/browser/browser/components/search/test/browser/opensearch.html";
    const EXPECTED_URL =
      "http://mochi.test:8888/browser/browser/components/search/test/browser/?search&test=search";
    BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, ENGINE_TEST_URL);
    await BrowserTestUtils.browserLoaded(
      win.gBrowser.selectedBrowser,
      false,
      ENGINE_TEST_URL
    );

    await CompanionHelper.whenReady(async () => {
      const query = "search";

      await UrlbarTestUtils.promiseAutocompleteResultPopup({
        window: win,
        value: query,
      });
      const resultIndex = UrlbarTestUtils.getResultCount(win) - 2;
      const result = await UrlbarTestUtils.getDetailsOfResultAt(
        win,
        resultIndex
      );

      Assert.equal(
        result.dynamicType,
        "contextualSearch",
        "Second last result is a contextual search result"
      );

      info("Focus and select the contextual search result");
      UrlbarTestUtils.setSelectedRowIndex(win, resultIndex);
      let newBrowserCreatedPromise = BrowserTestUtils.waitForNewTab(
        win.gBrowser,
        EXPECTED_URL,
        true
      );
      EventUtils.synthesizeKey("KEY_Enter", {}, win);
      await newBrowserCreatedPromise;

      Assert.equal(
        win.gBrowser.selectedBrowser.currentURI.spec,
        EXPECTED_URL,
        "Selecting the contextual search result opens the search URL"
      );
    }, win);
  });
});
