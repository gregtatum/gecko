/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the HistoryCarousel can change the current selection in the
 * ActiveViewManager, and changes to the selected View in the
 * ActiveViewManager can change the scroll position in the HistoryCarousel.
 */
add_task(async function selection_change() {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pagethumbnails.capturing_disabled", false]],
  });

  let [view1, view2, view3, view4] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

  let browser = await PinebuildTestUtils.enterHistoryCarousel();

  let { currentIndex } = await PinebuildTestUtils.getHistoryCarouselPreviews(
    browser
  );
  Assert.equal(currentIndex, 3, "Should have the last preview index selected.");
  Assert.ok(gStageManager.canGoBack, "Should be able to go back");

  // First, check that changing selections within the carousel update
  // the selected view in StageManager.
  let selected = PinebuildTestUtils.waitForSelectedView(view1);
  await PinebuildTestUtils.selectHistoryCarouselIndex(browser, 0);
  await selected;

  selected = PinebuildTestUtils.waitForSelectedView(view3);
  await PinebuildTestUtils.selectHistoryCarouselIndex(browser, 2);
  await selected;

  selected = PinebuildTestUtils.waitForSelectedView(view2);
  await PinebuildTestUtils.selectHistoryCarouselIndex(browser, 1);
  await selected;

  selected = PinebuildTestUtils.waitForSelectedView(view4);
  await PinebuildTestUtils.selectHistoryCarouselIndex(browser, 3);
  await selected;

  // Check that updating the selected view in StageManager changes the
  // selection within the carousel.
  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 1);
  await gStageManager.setView(view2);
  await selected;

  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 2);
  await gStageManager.setView(view3);
  await selected;

  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 0);
  await gStageManager.setView(view1);
  await selected;

  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 3);
  await gStageManager.setView(view4);
  await selected;

  // Now make sure we can use the back button to go back through the
  // carousel.
  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 2);
  await gStageManager.goBack();
  await selected;

  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 1);
  await gStageManager.goBack();
  await selected;

  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 0);
  await gStageManager.goBack();
  await selected;

  // We're at the earliest view, so going back should no longer be possible.
  Assert.ok(!gStageManager.canGoBack, "Should not be able to go back");

  // Now make sure that by selecting the last View, we only cause a
  // single HistoryCarouselIndexUpdated event to fire in content, rather
  // than one for each intermediary View on the way to the last one.
  let indexUpdatedCount = 0;
  let indexUpdatedHandler = event => indexUpdatedCount++;
  let removeContentEventListener = BrowserTestUtils.addContentEventListener(
    browser,
    "HistoryCarouselIndexUpdated",
    indexUpdatedHandler
  );
  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 3);
  await gStageManager.setView(view4);
  await selected;

  removeContentEventListener();

  Assert.equal(
    indexUpdatedCount,
    1,
    "Should have only seen 1 HistoryCarouselIndexUpdated event"
  );

  await PinebuildTestUtils.exitHistoryCarousel();
});
