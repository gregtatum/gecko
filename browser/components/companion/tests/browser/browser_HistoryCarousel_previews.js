/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that previews for each opened View are constructed properly.
 */
add_task(async function preview_construction() {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pagethumbnails.capturing_disabled", false]],
  });

  let views = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

  // Test for MR2-1598 - currently, we're choosing not to show previews
  // for pinned views.
  await PinebuildTestUtils.setCurrentView(views[0]);
  gStageManager.setViewPinnedState(views[0], true);
  await PinebuildTestUtils.setCurrentView(views[3]);

  // Test for MR2-1379 - we'll provide a user-edited title on one of
  // the views to ensure that it's properly displayed in the carousel.
  // This will be verified in the loop, since views[1].title should then
  // match TEST_USER_TITLE.
  const TEST_USER_TITLE = "This is a user-provided title";
  gStageManager.setUserTitle(views[1], TEST_USER_TITLE);
  registerCleanupFunction(async () => {
    // Setting a title adds a Snapshot, so let's be sure to clean up.
    await Snapshots.reset();
    await PlacesUtils.history.clear();
  });
  Assert.equal(
    views[1].title,
    TEST_USER_TITLE,
    "User title should be set on the first view."
  );

  let browser = await PinebuildTestUtils.enterHistoryCarousel();

  let {
    previews,
    currentIndex,
  } = await PinebuildTestUtils.getHistoryCarouselPreviews(browser);

  Assert.equal(previews.length, 3, "There should be 3 previews.");
  Assert.equal(currentIndex, 3, "The last preview should be current.");

  for (let preview of previews) {
    let view = views[preview.index];

    Assert.equal(
      view.title,
      preview.title,
      "The page title should be in the caption element."
    );
    Assert.equal(
      view.url.spec,
      preview.titleTooltip,
      "The page URL should be the tooltip for the caption."
    );
    Assert.equal(
      view.iconURL,
      preview.iconURL,
      "The page favicon should be set properly."
    );
    Assert.equal(
      view.pinned,
      preview.pinned,
      "The pinned attribute should be set properly."
    );

    if (preview.index == currentIndex) {
      Assert.ok(
        preview.hasBlob,
        "A blob image should be set on the preview for the current index."
      );
    } else if (!view.pinned) {
      todo(
        false,
        "Should reliably create wireframes for unloaded and unpinned views."
      );
    }
  }

  await PinebuildTestUtils.exitHistoryCarousel();
});
