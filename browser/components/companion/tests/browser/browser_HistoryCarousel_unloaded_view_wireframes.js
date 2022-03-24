/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PAGE_1 = "https://example.com/";
const PAGE_2 = "https://example.org/";
const PAGE_3 = "http://mochi.test:8888/";

/**
 * Tests that a wireframe gets captured for views that are unloaded due to
 * the discarding mechanism (which is used by TabUnloader during memory
 * pressure events).
 */
add_task(async function test_unloaded_view_wireframes() {
  // We want to test the case where there are multiple browser elements
  // in the DOM, so we turn on delegation to make it easier to ensure
  // that a new browser gets created when a navigation occurs.
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.tabs.openNewTabForMostNavigations", true],
      ["browser.pagethumbnails.capturing_disabled", false],
    ],
  });

  await PinebuildTestUtils.loadViews([PAGE_1]);

  Assert.equal(
    gBrowser.browsers.length,
    1,
    "Should have only 1 browser in the window"
  );

  let originalTab = gBrowser.selectedTab;

  // Now do a navigation that will cause a delegation and a new browser to be
  // created. We have to workaround the code in TopLevelNagigationDelegateChild
  // that intentionally doesn't delegate for navigations caused by the system
  // principal.
  let newTabPromise = BrowserTestUtils.waitForNewTab(gBrowser, PAGE_2, true);
  gBrowser.selectedBrowser.loadURI(PAGE_2, {
    triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({}),
  });
  let newTab = await newTabPromise;

  Assert.equal(gBrowser.selectedTab, newTab, "PAGE_2 tab is selected.");
  let stateUpdate = TestUtils.topicObserved(
    "browser-shutdown-tabstate-updated"
  );

  // We now discard originalTab. This is what the TabUnloader does for tabs it
  // considers acceptable to reclaim memory and processing time from when a
  // memory pressure event occurs.
  gBrowser.discardBrowser(originalTab);
  await stateUpdate;

  // Ensure that a wireframe was stored by SessionStore
  let tabState = JSON.parse(SessionStore.getTabState(originalTab));
  Assert.equal(
    tabState.entries.length,
    1,
    "Only 1 entry in the discarded tab."
  );
  Assert.ok(
    tabState.entries[0].wireframe,
    "A wireframe exists for the discarded tab."
  );

  // Now ensure that the wireframe is represented in the HistoryCarousel.
  let browser = await PinebuildTestUtils.enterHistoryCarousel();
  let {
    previews,
    currentIndex,
  } = await PinebuildTestUtils.getHistoryCarouselPreviews(browser);

  Assert.equal(previews.length, 2, "There should be 3 previews.");
  Assert.equal(currentIndex, 1, "The last preview should be current.");
  Assert.ok(
    previews[1].hasBlob,
    "Blob image should be used for the current preview."
  );
  Assert.ok(
    previews[0].hasWireframe,
    "Discarded browser should have a wireframe."
  );

  await PinebuildTestUtils.exitHistoryCarousel();
});
