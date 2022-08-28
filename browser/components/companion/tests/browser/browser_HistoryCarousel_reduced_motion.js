/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that setting prefers-reduced-motion to true while in the HistoryCarousel
 * let's the user exit completely.
 */
add_task(async function test_reduced_motion_change_while_in_history_carousel() {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  await SpecialPowers.pushPrefEnv({
    set: [
      ["browser.pagethumbnails.capturing_disabled", false],
      // Just in case, we'll make sure that the override pref for
      // prefers-reduced-motion is set to 0 so that we get the system
      // default.
      ["ui.prefersReducedMotion", 0],
    ],
  });

  // Let's ensure that we start with motion enabled.
  Assert.ok(
    !window.matchMedia("(prefers-reduced-motion)").matches,
    "Should not start with reduced motion enabled."
  );

  await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

  await PinebuildTestUtils.enterHistoryCarousel();

  // Now disable motion
  await SpecialPowers.pushPrefEnv({
    set: [["ui.prefersReducedMotion", 1]],
  });

  // And ensure that we can exit.
  await PinebuildTestUtils.exitHistoryCarousel();

  // Now re-enter with motion disabled.

  await PinebuildTestUtils.enterHistoryCarousel();

  // Re-enable motion
  await SpecialPowers.pushPrefEnv({
    set: [["ui.prefersReducedMotion", 1]],
  });

  // And ensure that we can exit.
  await PinebuildTestUtils.exitHistoryCarousel();
});
