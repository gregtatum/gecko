/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// To make this test shorter and less complicated, we'll temporarily modify
// the History results to show a maximum of MAX_RESULTS items.
const MAX_RESULTS = 5;
const NOW = Date.now() * 1000;

/**
 * PlacesTestUtils.addVisits expects visitDate's to be in microseconds.
 * This function will return a timestamp for NOW minus a number of seconds
 * in microseconds.
 *
 * @param {number} seconds
 *   The number of seconds since NOW to return the timestamp for.
 * @returns {number}
 *   The timestamp in microseconds.
 */
function timeSinceNow(seconds) {
  return NOW - seconds * 1000000;
}

/**
 * To make it easier to reason about this test, we're going to insert some
 * history visits with timestamps further and further into the past. This is
 * because the History list shows items in most-recently-visited order. We
 * therefore expect the results to appear in the list in the order that they
 * appear here in this array.
 */
const TEST_URLS = [
  { uri: "https://example.com/#the", title: "The", visitDate: timeSinceNow(1) },
  {
    uri: "https://example.com/#the-quick",
    title: "The quick",
    visitDate: timeSinceNow(2),
  },
  {
    uri: "https://example.com/#the-quick-brown",
    title: "The quick brown",
    visitDate: timeSinceNow(3),
  },
  {
    uri: "https://example.com/#the-quick-brown-fox",
    title: "The quick brown fox",
    visitDate: timeSinceNow(4),
  },
  {
    uri: "https://example.com/#the-quick-brown-fox-jumped",
    title: "The quick brown fox jumped",
    visitDate: timeSinceNow(5),
  },
  {
    uri: "https://example.com/#the-quick-brown-fox-jumped-over",
    title: "The quick brown fox jumped over",
    visitDate: timeSinceNow(6),
  },
  // Note that we're intentionally merging the second "the" in this
  // sentence with "lazy". This is because two instances of "the" will
  // still match the previous history entry.
  {
    uri: "https://example.com/#the-quick-brown-fox-jumped-over-the-lazy",
    title: "The quick brown fox jumped over the lazy",
    visitDate: timeSinceNow(7),
  },
  {
    uri: "https://example.com/#the-quick-brown-fox-jumped-over-the-lazy-dog",
    title: "The quick brown fox jumped over the lazy dog",
    visitDate: timeSinceNow(8),
  },
];

/**
 * Utility function that takes the HistoryResultsFooterDetails from
 * CompanionHelper.getHistoryResultsDetails and checks them against
 * expected results.
 *
 * @param {HistoryResultsFooterDetails} footer
 *   Details about the footer received via
 *   CompanionHelper.getHistoryResultsDetails.
 * @param {boolean} isShown
 *   True if the footer should be shown to the user.
 * @param {number} total
 *   The total number of results that should be reported shown after
 *   limiting is applied.
 * @param {number} totalBeforeLimit
 *   The total number of results that are reported as available before
 *   limiting is applied.
 */
function assertFooterShown(footer, isShown, total, totalBeforeLimit) {
  Assert.equal(
    footer.visible,
    isShown,
    "Footer should have correct visibility"
  );
  if (footer.visible) {
    Assert.deepEqual(
      footer.limitOutOfTotalArgs,
      {
        total,
        totalBeforeLimit,
      },
      "Footer should have the right total values."
    );
  }
}

add_setup(async () => {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.companion.history.max-results", MAX_RESULTS]],
  });
  await PlacesUtils.history.clear();
  await PlacesTestUtils.addVisits(TEST_URLS);
  registerCleanupFunction(async () => {
    await PlacesUtils.history.clear();
  });
});

/**
 * Tests that the History search results in the Companion can be
 * refined to a smaller set by using the search input.
 */
add_task(async () => {
  let helper = new CompanionHelper();
  await helper.selectHistoryTab();

  // Start by ensuring we get to see MAX_RESULTS results for our
  // History, since we haven't done any refining yet.
  let {
    searchInputValue,
    results,
    footer,
  } = await helper.getHistoryResultsDetails();
  Assert.equal(searchInputValue, "", "No query string in the search input.");
  Assert.equal(
    results.length,
    MAX_RESULTS,
    "Got the maximum number of results."
  );
  // These should match the first MAX_RESULTS items in TEST_URLS.
  for (let i = 0; i < results.length; i++) {
    helper.assertResultMatches(results[i], TEST_URLS[i]);
  }
  // And we should show a footer saying that there are more results than
  // can be shown.
  assertFooterShown(footer, true, MAX_RESULTS, TEST_URLS.length);

  // Now we're going to type in some refinement words. These first few
  // words will still result in the footer being displayed because the
  // number of available results will exceed MAX_RESULTS.
  const FIRST_WORDS = ["The", "quick", "brown"];
  for (let i = 0; i < FIRST_WORDS.length; ++i) {
    let queryString = FIRST_WORDS.slice(0, i + 1).join(" ");
    ({ results, footer } = await helper.refineHistoryResults(queryString));
    Assert.equal(
      results.length,
      MAX_RESULTS,
      "Got the maximum number of results."
    );
    // As we refine, we're going to be shifting the matches up the
    // TEST_URLS array. This means that after the second term goes in,
    // we'll no longer match TEST_URLS[0]. This next loop iterates the
    // results and matches against an increasing starting index within
    // TEST_URLS.
    for (let j = 0; j < results.length; j++) {
      helper.assertResultMatches(results[j], TEST_URLS[j + i]);
    }

    assertFooterShown(footer, true, MAX_RESULTS, TEST_URLS.length - i);
  }

  // With these last words, the footer should be hidden, and we'll see the
  // number of results start to decrease down to 1 once we've typed in the
  // last term.
  const LAST_WORDS = ["fox", "jumped", "over", "the lazy", "dog"];
  const FIRST_HALF = FIRST_WORDS.join(" ") + " ";
  for (let i = 0; i < LAST_WORDS.length; ++i) {
    let queryString = FIRST_HALF + LAST_WORDS.slice(0, i + 1).join(" ");
    ({ results, footer } = await helper.refineHistoryResults(queryString));
    Assert.equal(
      results.length,
      LAST_WORDS.length - i,
      "Got the right number of results."
    );

    // As before, we're sliding starting index within TEST_URLS that we're
    // matching results against. We also have to add FIRST_WORDS.length,
    // since we're already starting part-way through the TEST_URLS array.
    for (let j = 0; j < results.length; j++) {
      helper.assertResultMatches(
        results[j],
        TEST_URLS[j + i + FIRST_WORDS.length]
      );
    }

    assertFooterShown(footer, false);
  }
});
