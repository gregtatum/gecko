/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URLS = [
  { uri: "https://invalid.com/", title: "This is the first page" },
  { uri: "https://mochi.test/", title: "This is the second page" },
  { uri: "https://example.org/", title: "This is the third page" },
];

XPCOMUtils.defineLazyGetter(this, "UrlbarTestUtils", () => {
  const { UrlbarTestUtils: module } = ChromeUtils.import(
    "resource://testing-common/UrlbarTestUtils.jsm"
  );
  module.init(this);
  registerCleanupFunction(() => module.uninit());
  return module;
});

add_setup(async () => {
  await PlacesUtils.history.clear();
  await PlacesTestUtils.addVisits(TEST_URLS);
  registerCleanupFunction(async () => {
    await PlacesUtils.history.clear();
  });
});

/**
 * Helper function that does the following actions in the current window:
 *
 * 1. Puts a query into the navigation bar, and waits for the navigation
 *    bar panel to appear.
 * 2. Ensures that the 3rd item in the panel is the "Search within History"
 *    handoff item.
 * 3. Chooses that item via keyboard navigation.
 * 4. Makes sure that this puts the Companion into the visible state.
 * 5. Checks that the History tab is revealed in the Companion and selected.
 * 6. Checks that the query string has been placed into the search input
 * 7. Checks that the shown history result matches the expected result.
 *
 * @param {CompanionHelper} helper
 *   A CompanionHelper for the current window.
 * @param {string} queryString
 *   The query string to be used in the navigation bar.
 * @param {Object} expectedHistoryResult
 *   A description of the result that is expected in the History results
 *   section. See the documentation for CompanionHelper.assertResultMatches
 *   for more details.
 * @returns Promise
 * @resolves undefined
 */
async function testUrlbarHandoff(helper, queryString, expectedHistoryResult) {
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: queryString,
  });

  let result = await UrlbarTestUtils.getDetailsOfResultAt(window, 2);
  Assert.equal(
    result.dynamicType,
    "companionSearchLink",
    "Second Urlbar result is to search history in the Companion."
  );

  let historyPromise = helper.waitForHistoryResults();

  EventUtils.synthesizeKey("KEY_ArrowDown", {});
  EventUtils.synthesizeKey("KEY_ArrowDown", {});
  EventUtils.synthesizeKey("KEY_Enter", {});

  Assert.ok(
    BrowserTestUtils.is_visible(helper.browser),
    "Companion browser should now be visible"
  );

  info("Checking the state of the Companion");
  await helper.runCompanionTask(() => {
    ok(
      content.document.querySelector(".companion-main"),
      "The companion content is available"
    );

    let deck = content.document.querySelector("#companion-deck");
    Assert.equal(deck.selectedViewName, "history");
    let historyTab = content.document.querySelector(".tab-button.history");
    Assert.ok(
      !ContentTaskUtils.is_hidden(historyTab),
      "History tab button is not hidden."
    );
    let historyPane = content.document.querySelector(".history-panel");
    Assert.ok(
      !ContentTaskUtils.is_hidden(historyPane),
      "History pane is not hidden."
    );
  });

  await historyPromise;

  let historyDetails = await helper.getHistoryResultsDetails();
  Assert.equal(historyDetails.searchInputValue, queryString);
  Assert.equal(
    historyDetails.results.length,
    1,
    "Should only have a single result."
  );
  helper.assertResultMatches(historyDetails.results[0], expectedHistoryResult);
}

/**
 * Tests that the UrlbarProviderOpenCompanionSearch provider will
 * cause the Companion to reveal the History tab with the query
 * transferred over if the Companion starts closed.
 */
add_task(async function test_companion_starts_closed() {
  // Start with the Companion sidebar closed.
  let helper = new CompanionHelper();
  await helper.companionReady;
  helper.closeCompanion();

  Assert.ok(
    BrowserTestUtils.is_hidden(helper.browser),
    "Companion browser should be hidden"
  );

  // We'll search for the result with the title "This is the first page".
  await testUrlbarHandoff(helper, "first", TEST_URLS[0]);
});

/**
 * Tests that the UrlbarProviderOpenCompanionSearch provider will
 * cause the Companion to reveal the History tab with the query
 * transferred over if the Companion is already open.
 */
add_task(async function test_companion_starts_open() {
  // Start with the Companion sidebar open.
  let helper = new CompanionHelper();
  await helper.companionReady;
  helper.openCompanion();

  Assert.ok(
    !BrowserTestUtils.is_hidden(helper.browser),
    "Companion browser should be visible"
  );
  await helper.selectCompanionTab("now");
  await testUrlbarHandoff(helper, "second", TEST_URLS[1]);
});
