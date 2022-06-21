/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the fade effect at the bottom of the History panel is probably
 * applied and removed depending on whether or not the list overflows.
 */

// The number of test history results to create.
const URLS_TO_MAKE = 100;
// The maximum number of history results we show by default.
const DEFAULT_MAXIMUM_RESULTS = 50;

add_setup(async () => {
  let urls = [];
  for (let i = 0; i < URLS_TO_MAKE; ++i) {
    urls.push({
      uri: `https://example.com/#${i}`,
      title: `Example visit #${i}`,
    });
  }

  await PlacesUtils.history.clear();
  await PlacesTestUtils.addVisits(urls);
  registerCleanupFunction(async () => {
    await PlacesUtils.history.clear();
  });
});

add_task(async function test_fade_applied_and_removed() {
  let helper = new CompanionHelper();
  await helper.selectHistoryTab();

  let {
    searchInputValue,
    results,
    footer,
    hasBottomFade,
  } = await helper.getHistoryResultsDetails();
  Assert.equal(searchInputValue, "", "No query string in the search input.");
  Assert.equal(
    results.length,
    DEFAULT_MAXIMUM_RESULTS,
    "Got the default maximum number of results."
  );
  Assert.ok(footer.visible, "Footer should be visible.");
  Assert.ok(
    hasBottomFade,
    "Should have bottom fade for such a long list of results."
  );

  // The search term "99" should only match a single result.
  ({ results, footer, hasBottomFade } = await helper.refineHistoryResults(
    "99"
  ));
  Assert.equal(results.length, 1, "Got only a single result.");
  Assert.ok(!footer.visible, "Footer should not be visible.");
  Assert.ok(!hasBottomFade, "Bottom fade should have been removed.");
});
