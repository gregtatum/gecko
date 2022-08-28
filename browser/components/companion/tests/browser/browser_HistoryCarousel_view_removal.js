/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async function() {
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.pagethumbnails.capturing_disabled", false],
      ["browser.pinebuild.megaback.logLevel", "All"],
    ],
  });
});

/**
 * Tests that previews in the history carousel are updated when a view is
 * removed.
 */
add_task(async function preview_removal() {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  let views = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

  let browser = await PinebuildTestUtils.enterHistoryCarousel();

  let {
    previews,
    currentIndex,
  } = await PinebuildTestUtils.getHistoryCarouselPreviews(browser);

  Assert.equal(previews.length, 4, "There should be 4 previews.");
  Assert.equal(currentIndex, 3, "The last preview should be current.");

  let indexUpdated = BrowserTestUtils.waitForContentEvent(
    browser,
    "HistoryCarouselIndexUpdated"
  );
  // Let's close the last view, which is the selected one.
  gStageManager.closeView(views[3]);
  await indexUpdated;

  ({
    previews,
    currentIndex,
  } = await PinebuildTestUtils.getHistoryCarouselPreviews(browser));

  Assert.equal(previews.length, 3, "There should be 3 previews now.");
  Assert.equal(currentIndex, 2, "The last preview should be selected.");

  // Let's do that one more time.
  indexUpdated = BrowserTestUtils.waitForContentEvent(
    browser,
    "HistoryCarouselIndexUpdated"
  );
  // Let's close the last view, which is the selected one.
  gStageManager.closeView(views[2]);
  await indexUpdated;

  ({
    previews,
    currentIndex,
  } = await PinebuildTestUtils.getHistoryCarouselPreviews(browser));

  Assert.equal(previews.length, 2, "There should be 3 previews now.");
  Assert.equal(currentIndex, 1, "The last preview should be selected.");

  await PinebuildTestUtils.exitHistoryCarousel();
});
