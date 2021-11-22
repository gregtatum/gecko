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

  // First, check that changing selections within the carousel update
  // the selected view in GlobalHistory.
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

  // And finally, check that updating the selected view in GlobalHistory
  // changes the selection within the carousel.
  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 1);
  await gGlobalHistory.setView(view2);
  await selected;

  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 2);
  await gGlobalHistory.setView(view3);
  await selected;

  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 0);
  await gGlobalHistory.setView(view1);
  await selected;

  selected = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(browser, 3);
  await gGlobalHistory.setView(view4);
  await selected;

  await PinebuildTestUtils.exitHistoryCarousel();
});
