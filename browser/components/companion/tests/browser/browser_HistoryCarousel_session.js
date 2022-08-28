/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

// This is the session guid that will be generated in the first add_task,
// and used in the second.
var guid = null;

/**
 * Tests that the history carousel is exited if the user changes the
 * session state of the window.
 */

add_setup(async function() {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pagethumbnails.capturing_disabled", false]],
  });
});

/**
 * Test that the history carousel is exited if the current session is set
 * aside.
 */
add_task(async function test_set_aside() {
  await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

  await PinebuildTestUtils.enterHistoryCarousel();

  let historyCarouselClosed = BrowserTestUtils.waitForEvent(
    window,
    "HistoryCarousel:TransitionEnd"
  );

  guid = await PinebuildTestUtils.setAsideSession();
  await historyCarouselClosed;

  Assert.ok(
    !window.gHistoryCarousel.enabled,
    "History carousel should not be enabled now."
  );

  await gStageManager.reset();
});

/**
 * Test that the history carousel is exited if an old session is restored.
 */
add_task(async function test_restore() {
  await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
  ]);

  await PinebuildTestUtils.enterHistoryCarousel();

  let historyCarouselClosed = BrowserTestUtils.waitForEvent(
    window,
    "HistoryCarousel:TransitionEnd"
  );
  await PinebuildTestUtils.restoreSession(guid);
  await historyCarouselClosed;

  Assert.ok(
    !window.gHistoryCarousel.enabled,
    "History carousel should not be enabled now."
  );
});
