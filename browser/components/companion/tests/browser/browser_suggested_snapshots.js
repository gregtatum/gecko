/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URLS = [
  { uri: "https://invalid.com/", title: "Page 0" },
  { uri: "https://foo.com/", title: "Page 1" },
  { uri: "https://bar.com/", title: "Page 2" },
  { uri: "https://example.com/", title: "mochitest index /" },
  { uri: "https://example.com/browser/", title: "mochitest index /browser/" },
];

const { FilterAdult } = ChromeUtils.import(
  "resource://activity-stream/lib/FilterAdult.jsm"
);
const { Interactions } = ChromeUtils.import(
  "resource:///modules/Interactions.jsm"
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
  await Interactions.reset();
  await PlacesUtils.history.clear();
  await PlacesTestUtils.addVisits(TEST_URLS);
  let created = Date.now() - 10000;
  for (let { uri, title } of TEST_URLS) {
    await Interactions.store.add({
      url: uri,
      title,
      documentType: Interactions.DOCUMENT_TYPE.GENERIC,
      totalViewTime: 0,
      typingTime: 0,
      keypresses: 0,
      scrollingTime: 0,
      scrollingDistance: 0,
      created_at: created,
      updated_at: created,
    });
    created += 1000;
  }
  await Interactions.store.flush();

  await Snapshots.add({ url: TEST_URLS[0].uri, userPersisted: true });
  await Snapshots.add({ url: TEST_URLS[3].uri, userPersisted: true });

  // Run test in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URLS[3].uri);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URLS[3].uri
  );

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
    await Snapshots.reset();
    await PlacesUtils.history.clear();
  });
});

add_task(async function test_suggested_snapshots_displayed() {
  await CompanionHelper.whenReady(async helper => {
    await testSnapshotTitles(helper, [TEST_URLS[0].title]);

    await Snapshots.add({ url: TEST_URLS[1].uri, userPersisted: true });

    // Snapshots are display with most recent first.
    await testSnapshotTitles(helper, [TEST_URLS[1].title, TEST_URLS[0].title]);
  }, win);
});

add_task(async function test_suggested_snapshots_filter_adult() {
  await CompanionHelper.whenReady(async helper => {
    FilterAdult.addDomainToList(TEST_URLS[2].uri);
    await Snapshots.add({ url: TEST_URLS[2].uri, userPersisted: true });
    // Wait a little bit to ensure that the URLs are separated in time.
    // eslint-disable-next-line mozilla/no-arbitrary-setTimeout
    await new Promise(r => setTimeout(r, 100));
    await Snapshots.add({ url: TEST_URLS[3].uri, userPersisted: true });

    await testSnapshotTitles(helper, [TEST_URLS[1].title, TEST_URLS[0].title]);

    FilterAdult.removeDomainFromList(TEST_URLS[2].uri);
  }, win);
});

add_task(async function test_current_snapshot_hidden() {
  await CompanionHelper.whenReady(async helper => {
    await testSnapshotTitles(
      helper,
      [TEST_URLS[2].title, TEST_URLS[1].title, TEST_URLS[0].title],
      // The page we're on shouldn't be displayed.
      TEST_URLS[3].title
    );

    let originalTab = win.gBrowser.selectedTab;

    // Switch to a new page, to make sure the snapshot re-appears.
    await BrowserTestUtils.openNewForegroundTab({
      gBrowser: win.gBrowser,
      opening: TEST_URLS[4].uri,
      waitForStateStop: true,
    });

    await testSnapshotTitles(
      helper,
      TEST_URLS.slice(0, -1)
        .map(t => t.title)
        .reverse()
    );

    // Now switch back to the original tab and make sure the snapshot is hidden
    // again.
    win.gBrowser.selectedTab = originalTab;

    await testSnapshotTitles(
      helper,
      [TEST_URLS[2].title, TEST_URLS[1].title, TEST_URLS[0].title],
      TEST_URLS[3].title
    );
  }, win);
});

add_task(async function test_scorer() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.snapshots.relevancy.enabled", true]],
  });

  // This snapshot will score lower than the threshold.
  const url = "https://example.com/browser/components/";
  await PlacesTestUtils.addVisits(url);
  await Interactions.store.add({
    url,
    title: "mochitest index /browser/components",
    documentType: Interactions.DOCUMENT_TYPE.GENERIC,
    totalViewTime: 0,
    typingTime: 0,
    keypresses: 0,
    scrollingTime: 0,
    scrollingDistance: 0,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
  await Interactions.store.flush();
  await Snapshots.add({ url });

  // Open a new window so the pref takes effect.
  let scorerWin = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(scorerWin);
  });

  BrowserTestUtils.loadURI(
    scorerWin.gBrowser.selectedBrowser,
    TEST_URLS[4].uri
  );
  await BrowserTestUtils.browserLoaded(
    scorerWin.gBrowser.selectedBrowser,
    false,
    TEST_URLS[4].uri
  );

  await CompanionHelper.whenReady(async helper => {
    await testSnapshotTitles(
      helper,
      [
        TEST_URLS[3].title,
        TEST_URLS[2].title,
        TEST_URLS[1].title,
        TEST_URLS[0].title,
      ],
      TEST_URLS[4].title
    );
  }, scorerWin);
});
