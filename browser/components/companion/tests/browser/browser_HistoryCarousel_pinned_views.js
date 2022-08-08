/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Pinning can create Snapshots, so let's go ahead and blow those away
 * after this test is done.
 */
add_setup(async () => {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pagethumbnails.capturing_disabled", false]],
  });

  registerCleanupFunction(async () => {
    await Snapshots.reset();
    await PlacesUtils.history.clear();
  });
});

/**
 * Tests that the HistoryCarousel cannot be entered when the current
 * view is pinned.
 */
add_task(async function test_no_history_carousel_on_pinned_views() {
  let [, , view3, view4] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

  // Now pin the current View
  gStageManager.setViewPinnedState(view4, true);
  Assert.ok(gStageManager.currentView.pinned, "Current View should be pinned.");

  // We don't use PinebuildTestUtils.enterHistoryCarousel because we
  // actually expect showHistoryCarousel(true); here to do nothing.
  await window.gHistoryCarousel.showHistoryCarousel(true);
  Assert.ok(
    !window.gHistoryCarousel.enabled,
    "Should not have successfully entered HistoryCarousel."
  );

  // Now ensure that we can enter if we have a non-pinned View selected.
  await PinebuildTestUtils.setCurrentView(view3);
  Assert.ok(
    !gStageManager.currentView.pinned,
    "Current View should not be pinned."
  );
  await PinebuildTestUtils.enterHistoryCarousel();
  await PinebuildTestUtils.exitHistoryCarousel();
});
