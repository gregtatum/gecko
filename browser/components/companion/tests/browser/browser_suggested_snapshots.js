/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URL0 = "https://example.com/";
const TEST_URL1 = "https://invalid.com/";
const TEST_URL2 = "https://foo.com/";
const TEST_URL3 = "https://bar.com/";
const TITLES = ["mochitest index /", "Page 2", "Page 3", "Page 4"];

const { FilterAdult } = ChromeUtils.import(
  "resource://activity-stream/lib/FilterAdult.jsm"
);

let win;

/**
 * Tests snapshot titles are correctly displayed in the companion.
 *
 * @param {object} helper
 *   The test helper associated with the companion.
 * @param {string[]} expectedTitles
 *   An array of titles in display order from top to bottom.
 * @param {string} [excludedTitle]
 *   A title that should be excluded from the results list, this feeds
 *   the waitForCondition to ensure the page is not listed before checking
 *   the results.
 */
function testSnapshotTitles(helper, expectedTitles, excludedTitle) {
  return helper.runCompanionTask(
    async (PAGE_TITLES, EXCLUDED_TITLE) => {
      let suggestedSnapshots = content.document.querySelector(
        "e-suggested-snapshot-list"
      );

      await ContentTaskUtils.waitForCondition(() => {
        let snapshots = Array.from(
          suggestedSnapshots.querySelectorAll("e-snapshot")
        );
        return (
          snapshots.length == PAGE_TITLES.length &&
          (!EXCLUDED_TITLE ||
            snapshots.every(
              e => e.querySelector(".title").textContent != EXCLUDED_TITLE
            ))
        );
      }, "Should be the correct number of links displayed");

      let snapshots = suggestedSnapshots.querySelectorAll("e-snapshot");
      for (let i = 0; i < PAGE_TITLES.length; i++) {
        Assert.equal(
          snapshots[i].querySelector(".title").textContent,
          PAGE_TITLES[i]
        );
      }
    },
    [expectedTitles, excludedTitle]
  );
}

add_task(async function setup() {
  await PlacesTestUtils.addVisits([
    { uri: TEST_URL0, title: TITLES[0] },
    { uri: TEST_URL1, title: TITLES[1] },
    { uri: TEST_URL2, title: TITLES[2] },
    { uri: TEST_URL3, title: TITLES[3] },
  ]);
  await Snapshots.add({ url: TEST_URL0, userPersisted: true });

  // Run test in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
    await Snapshots.reset();
    await PlacesUtils.history.clear();
  });
});

add_task(async function test_suggested_snapshots_displayed() {
  await CompanionHelper.whenReady(async helper => {
    await testSnapshotTitles(helper, [TITLES[0]]);

    await Snapshots.add({ url: TEST_URL1, userPersisted: true });

    // Snapshots are display with most recent first.
    await testSnapshotTitles(helper, [TITLES[1], TITLES[0]]);
  }, win);
});

add_task(async function test_suggested_snapshots_filter_adult() {
  await CompanionHelper.whenReady(async helper => {
    FilterAdult.addDomainToList(TEST_URL2);
    await Snapshots.add({ url: TEST_URL2, userPersisted: true });
    // Wait a little bit to ensure that the URLs are separated in time.
    // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
    await new Promise(r => setTimeout(r, 100));
    await Snapshots.add({ url: TEST_URL3, userPersisted: true });

    await testSnapshotTitles(helper, [TITLES[3], TITLES[1], TITLES[0]]);

    FilterAdult.removeDomainFromList(TEST_URL2);
  }, win);
});

add_task(async function test_current_snapshot_hidden() {
  await CompanionHelper.whenReady(async helper => {
    // There are four snapshots added when starting the test, visit the first.
    BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL0);
    await BrowserTestUtils.browserLoaded(
      win.gBrowser.selectedBrowser,
      false,
      TEST_URL0
    );

    await testSnapshotTitles(
      helper,
      [TITLES[3], TITLES[2], TITLES[1]],
      // The page we're on shouldn't be displayed.
      TITLES[0]
    );

    let originalTab = win.gBrowser.selectedTab;

    // Switch to an about page, to make sure the snapshot re-appears.
    await BrowserTestUtils.openNewForegroundTab({
      gBrowser: win.gBrowser,
      opening: "about:robots",
      waitForStateStop: true,
    });

    await testSnapshotTitles(helper, [...TITLES].reverse());

    // Now switch back to the original tab and make sure the snapshot is hidden
    // again.
    win.gBrowser.selectedTab = originalTab;

    await testSnapshotTitles(
      helper,
      [TITLES[3], TITLES[2], TITLES[1]],
      TITLES[0]
    );
  }, win);
});
