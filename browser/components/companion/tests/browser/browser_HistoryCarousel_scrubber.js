/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the scrubber (and its previous/next buttons) at the bottom of the
 * HistoryCarousel lets the user choose which preview is selected.
 */
add_task(async function test_scrubber() {
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
  // for pinned views. The scrubber should reflect that.
  await PinebuildTestUtils.setCurrentView(views[0]);
  gStageManager.setViewPinnedState(views[0], true);
  await PinebuildTestUtils.setCurrentView(views[3]);

  let browser = await PinebuildTestUtils.enterHistoryCarousel();

  let { currentIndex } = await PinebuildTestUtils.getHistoryCarouselPreviews(
    browser
  );
  Assert.equal(currentIndex, 3, "Should have the last preview index selected.");

  await SpecialPowers.spawn(browser, [], async () => {
    let scrubber = content.document.getElementById("scrubber");
    let previousBtn = content.document.getElementById("previous");
    let nextBtn = content.document.getElementById("next");

    // Make sure the parameters of the scrubber have been set up properly.
    let min = parseInt(scrubber.getAttribute("min"), 0);
    let max = parseInt(scrubber.getAttribute("max"), 0);
    let step = parseInt(scrubber.getAttribute("step"), 0);
    Assert.equal(
      min,
      1,
      "The pinned view should have been accounted for when setting scrubber min."
    );
    Assert.equal(
      max,
      3,
      "Should not be able to select an index past the end of the preview array."
    );
    Assert.equal(step, 1, "Should step by 1 preview element at a time.");

    // Because the last preview is currently selected, the "next" button should
    // be disabled.
    Assert.ok(nextBtn.disabled, "Next button is disabled.");
    Assert.ok(!previousBtn.disabled, "Previous button is not disabled.");

    let waitForSelectedIndex = index => {
      let avmUpdated = SpecialPowers.spawnChrome([index], viewIndex => {
        let window = this.browsingContext.topChromeWindow;
        let { gStageManager } = window;
        let view = gStageManager.views[viewIndex];
        return new Promise(resolve => {
          let onViewChanged = event => {
            if (event.view == view) {
              gStageManager.removeEventListener("ViewChanged", onViewChanged);
              resolve();
            }
          };
          gStageManager.addEventListener("ViewChanged", onViewChanged);
        });
      });
      let carouselUpdated = ContentTaskUtils.waitForEvent(
        content,
        "HistoryCarouselIndexUpdated",
        false,
        e => {
          return e.detail == index;
        }
      );

      return Promise.all([avmUpdated, carouselUpdated]);
    };

    let selectIndex = async index => {
      scrubber.valueAsNumber = index;
      scrubber.dispatchEvent(new content.Event("input", { bubbles: true }));
      await waitForSelectedIndex(index);
    };

    await selectIndex(1);
    // Because the first unpinned preview is currently selected, the "previous"
    // button should now be disabled.
    Assert.ok(!nextBtn.disabled, "Next button is not disabled.");
    Assert.ok(previousBtn.disabled, "Previous button is disabled.");

    await selectIndex(2);
    Assert.ok(!nextBtn.disabled, "Next button is not disabled.");
    Assert.ok(!previousBtn.disabled, "Previous button is not disabled.");

    await selectIndex(3);
    // We've selected the last preview again, so the next button should be
    // disabled again.
    Assert.ok(nextBtn.disabled, "Next button is disabled.");
    Assert.ok(!previousBtn.disabled, "Previous button is not disabled.");

    info("Selecting index 2 in test via previous button");
    let selected = waitForSelectedIndex(2);
    previousBtn.click();
    await selected;
    Assert.ok(true, "Selected previous index with previous button.");

    info("Selecting index 1 in test via previous button");
    selected = waitForSelectedIndex(1);
    previousBtn.click();
    await selected;
    Assert.ok(true, "Selected previous index with previous button.");

    // Because the first non-pinned preview is currently selected, the "previous"
    // button should now be disabled.
    Assert.ok(!nextBtn.disabled, "Next button is not disabled.");
    Assert.ok(previousBtn.disabled, "Previous button is disabled.");

    info("Selected index 2 from next button");
    selected = waitForSelectedIndex(2);
    nextBtn.click();
    await selected;
    Assert.ok(true, "Selected next index with next button.");

    info("Selected index 3 from next button");
    selected = waitForSelectedIndex(3);
    nextBtn.click();
    await selected;
    Assert.ok(true, "Selected next index with next button.");

    // We've selected the last preview again, so the next button should be
    // disabled again.
    Assert.ok(nextBtn.disabled, "Next button is disabled.");
    Assert.ok(!previousBtn.disabled, "Previous button is not disabled.");
  });

  await PinebuildTestUtils.exitHistoryCarousel();
});
