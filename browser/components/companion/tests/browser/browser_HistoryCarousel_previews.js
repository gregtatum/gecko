/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that previews for each opened View are constructed properly.
 */
add_task(async function preview_construction() {
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

  for (let i = 0; i < previews.length; ++i) {
    let view = views[i];
    let preview = previews[i];

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

    if (i == currentIndex) {
      Assert.ok(
        preview.hasBlob,
        "A blob image should be set on the preview for the current index."
      );
    } else {
      // MR2-1390 - These other views don't have wireframes set up for them
      // yet.
      todo(preview.hasWireframe, "A wireframe should be set on the preview.");
    }
  }

  await PinebuildTestUtils.exitHistoryCarousel();
});
