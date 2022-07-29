/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that query tokens are properly highlighted (bolded)
 * within the title of a history result when a query is supplied.
 */

const TEST_URLS = [
  { uri: "https://example.com/#mozilla", title: "Mozilla" },
  {
    uri: "https://example.com/#ALL-CAPS",
    title: "ALL CAPS",
  },
  {
    uri: "https://example.com/#all-lower",
    title: "all lower",
  },
  {
    uri: "https://example.com/#no-title-supplied",
    title: "",
  },
  {
    uri: "https://example.com/#the-quick-brown-fox-jumped-over-the",
    title: "The quick brown fox jumped over the",
  },
];

/**
 * Helper function that does a query refinement and expects a single
 * result. That single result is then tested against a description
 * with a particular highlight.
 *
 * @param {CompanionHelper} helper
 *   The CompanionHelper for the window being tested.
 * @param {String} queryString
 *   The string to do the refinement query with.
 * @param {Object} description
 *   The description of a visit passed to PlacesTestUtils.addVisits to match
 *   the result against.
 * @param {String[]} highlights
 *   An array of words within the title that we expect to be highlighted
 *   with <strong> tags.
 * @returns Promise
 * @resolves undefined
 */
async function testHighlightsForSingleResult(
  helper,
  queryString,
  description,
  highlights
) {
  const { results } = await helper.refineHistoryResults(queryString);
  Assert.equal(results.length, 1, "Got a single result.");
  helper.assertResultMatches(results[0], description, highlights);
}

add_setup(async () => {
  await PlacesUtils.history.clear();
  await PlacesTestUtils.addVisits(TEST_URLS);
  registerCleanupFunction(async () => {
    await PlacesUtils.history.clear();
  });
});

add_task(async function test_highlights() {
  let helper = new CompanionHelper();
  await helper.revealHistoryTab();

  // Start by ensuring we get to see MAX_RESULTS results for our
  // History, since we haven't done any refining yet.
  let { searchInputValue, results } = await helper.getHistoryResultsDetails(
    true /* reverse */
  );
  Assert.equal(searchInputValue, "", "No query string in the search input.");
  Assert.equal(
    results.length,
    TEST_URLS.length,
    "Got the total number of results."
  );

  // We expect no highlights initially.
  for (let i = 0; i < results.length; i++) {
    helper.assertResultMatches(results[i], TEST_URLS[i], [
      /* no highlights expected */
    ]);
  }

  await testHighlightsForSingleResult(helper, "mozilla", TEST_URLS[0], [
    "Mozilla",
  ]);
  await testHighlightsForSingleResult(helper, "moz", TEST_URLS[0], ["Moz"]);
  await testHighlightsForSingleResult(helper, "all caps", TEST_URLS[1], [
    "ALL",
    "CAPS",
  ]);
  await testHighlightsForSingleResult(helper, "ALL LOWER", TEST_URLS[2], [
    "all",
    "lower",
  ]);
  await testHighlightsForSingleResult(
    helper,
    "No title Supplied",
    TEST_URLS[3],
    ["no", "title", "supplied"]
  );
  await testHighlightsForSingleResult(
    helper,
    "ThE qUiCk foX bRoWn",
    TEST_URLS[4],
    ["The", "quick", "brown", "fox", "the"]
  );
});
