/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URLS = [
  { uri: "https://example.com/", title: "This is the first page" },
  { uri: "http://mochi.test:8888/", title: "This is the second page" },
];

add_setup(async () => {
  await PlacesUtils.history.clear();
  await PlacesTestUtils.addVisits(TEST_URLS);
  registerCleanupFunction(async () => {
    await PlacesUtils.history.clear();
  });

  let helper = new CompanionHelper();
  await helper.companionReady;
  helper.openCompanion();
});

/**
 * Tests that clicking on a History result will open that result in a
 * new View.
 */
add_task(async function test_open_new_view() {
  let helper = new CompanionHelper();
  await helper.revealHistoryTab();
  let { results } = await helper.getHistoryResultsDetails();
  // Let's choose to click on the first result in the list.
  const TARGET_INDEX = 0;
  const TARGET_URL = results[TARGET_INDEX].url;

  let viewLoadedPromise = PinebuildTestUtils.waitForNewView(
    gBrowser.selectedBrowser,
    TARGET_URL
  );
  await helper.clickHistoryResultAtIndex(TARGET_INDEX);
  await viewLoadedPromise;
  Assert.ok(true, "Saw the target URL loaded in a new View.");
  await gStageManager.reset();
});

/**
 * Tests that clicking on a History result for an existing background View
 * will switch to that View.
 */
add_task(async function test_switch_to_view() {
  let helper = new CompanionHelper();
  await helper.revealHistoryTab();
  let { results } = await helper.getHistoryResultsDetails();
  // Let's choose to click on the first result in the list.
  const TARGET_INDEX = 0;
  const TARGET_URL = results[TARGET_INDEX].url;

  // Let's open that as a View, and then switch to something else.
  let [targetView] = await PinebuildTestUtils.loadViews([TARGET_URL]);
  await BrowserTestUtils.openNewForegroundTab(gBrowser, "http://example.com");

  Assert.equal(
    gBrowser.browsers.length,
    2,
    "Should have 2 browsers in the window"
  );
  Assert.equal(gStageManager.views.length, 2, "Should have 2 views now");

  Assert.notEqual(
    gStageManager.currentView,
    targetView,
    "The target View is in the background."
  );

  let viewSwitchedPromise = PinebuildTestUtils.waitForSelectedView(targetView);
  await helper.clickHistoryResultAtIndex(TARGET_INDEX);
  await viewSwitchedPromise;
  Assert.ok(true, "Switched to a background View with the target URI.");
  await gStageManager.reset();
});

/**
 * Tests that clicking on a History result for an existing foreground View
 * will be a no-op.
 */
add_task(async function test_switch_current_view() {
  let helper = new CompanionHelper();
  await helper.revealHistoryTab();
  let { results } = await helper.getHistoryResultsDetails();
  // Let's choose to click on the first result in the list.
  const TARGET_INDEX = 0;
  const TARGET_URL = results[TARGET_INDEX].url;

  // Let's open that as a View, and then switch to something else.
  let [targetView] = await PinebuildTestUtils.loadViews([TARGET_URL]);
  Assert.equal(
    gStageManager.currentView,
    targetView,
    "The target View is in the background."
  );

  let originalBrowser = gBrowser.selectedBrowser;
  await helper.clickHistoryResultAtIndex(TARGET_INDEX);
  Assert.equal(gBrowser.selectedBrowser, originalBrowser);
  await gStageManager.reset();
});
