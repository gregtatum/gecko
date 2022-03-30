/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests keyboard navigation and control from within the HistoryCarousel.
 */
add_task(async function test_keyboard_controls() {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pagethumbnails.capturing_disabled", false]],
  });

  let [view0, view1, view2, view3] = await PinebuildTestUtils.loadViews([
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

  // First, lets ensure that the keyboard left and right cursors can be used to
  // change the selected preview.
  let testKey = async (keyCode, expectedView, expectedIndex) => {
    let selected = PinebuildTestUtils.waitForSelectedView(expectedView);
    let indexChanged = PinebuildTestUtils.waitForSelectedHistoryCarouselIndex(
      browser,
      expectedIndex
    );

    // We synthesize the key event inside of a SpecialPowers.spawn to ensure
    // that the asynchronous task setting up the event listeners in
    // waitForSelectedHistoryCarouselIndex have had a chance to be set
    // up. Using BrowserTestUtils.synthesizeKey immediately here would
    // open the possibility of the key event firing _before_ the task spawned
    // in waitForSelectedHistoryCarouselIndex is done setting up.
    //
    // See bug 1743857.
    await SpecialPowers.spawn(browser, [keyCode], keyCodeToSimulate => {
      const { EventUtils } = ChromeUtils.import(
        "resource://specialpowers/SpecialPowersEventUtils.jsm"
      );
      EventUtils.synthesizeKey(keyCodeToSimulate, {}, this.content);
    });

    await indexChanged;
    await selected;
  };

  // view3 was originally selected, so by hitting the left cursor, we'll first
  // go to view2.
  await testKey("KEY_ArrowLeft", view2, 2);
  await testKey("KEY_ArrowLeft", view1, 1);
  await testKey("KEY_ArrowLeft", view0, 0);
  await testKey("KEY_ArrowRight", view1, 1);
  await testKey("KEY_ArrowRight", view2, 2);

  // Next, test that if we select a view that wasn't the original, and then
  // hit Escape, that we exit the HistoryCarousel and show the original view.
  // The original view is view3.
  let historyCarouselClosed = BrowserTestUtils.waitForEvent(
    window,
    "HistoryCarousel:TransitionEnd"
  );
  testKey("KEY_Escape", view3, 3);
  await historyCarouselClosed;

  // Now re-enter HistoryCarousel, select view2, and hit Enter. This should
  // cause view2 to be the selected view.
  browser = await PinebuildTestUtils.enterHistoryCarousel();
  await testKey("KEY_ArrowLeft", view2, 2);
  historyCarouselClosed = BrowserTestUtils.waitForEvent(
    window,
    "HistoryCarousel:TransitionEnd"
  );
  let viewChangedPromise = PinebuildTestUtils.waitForSelectedView(view2);
  await BrowserTestUtils.synthesizeKey("KEY_Enter", {}, browser);
  await historyCarouselClosed;
  await viewChangedPromise;

  Assert.equal(gStageManager.currentView, view2);
});
