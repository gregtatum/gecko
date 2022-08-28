/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Returns the isInModalState state for all browsers in the current window.
 *
 * @return {Promise}
 * @resolves {boolean[]} The array of modal state values. The indices for
 * the results should map to the indices of the associated browsers in
 * gBrowser.browsers.
 */
function gatherModalStates() {
  return Promise.all(
    gBrowser.browsers.map(browser => {
      return SpecialPowers.spawn(browser, [], () => {
        return content.windowUtils.isInModalState();
      });
    })
  );
}

/**
 * Tests that the browser window has its various components enter the appropiate
 * states when entering the history carousel, and that those states are cleared
 * upon exiting the carousel.
 */
add_task(async function test_modal_state() {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pagethumbnails.capturing_disabled", false]],
  });

  await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

  Assert.ok(
    (await gatherModalStates()).every(state => !state),
    "No browser elements should start in the modal state."
  );
  Assert.ok(
    !gBrowser.tabbox.hasAttribute("disable-history-animations"),
    "The window should not have view transitions disabled."
  );

  let carouselBrowser = await PinebuildTestUtils.enterHistoryCarousel();
  let states = await gatherModalStates();
  for (let i = 0; i < states.length; ++i) {
    if (gBrowser.browsers[i] == carouselBrowser) {
      Assert.ok(
        !states[i],
        "HistoryCarousel browser should not be in the modal state."
      );
    } else {
      Assert.ok(states[i], "Background browser should be in the modal state.");
    }
  }

  Assert.ok(
    gBrowser.tabbox.hasAttribute("disable-history-animations"),
    "The window should have view transitions disabled."
  );

  await PinebuildTestUtils.exitHistoryCarousel();

  Assert.ok(
    (await gatherModalStates()).every(state => !state),
    "No browser elements should remain in the modal state."
  );
  await BrowserTestUtils.waitForCondition(() => {
    return !gBrowser.tabbox.hasAttribute("disable-history-animations");
  }, "The window re-enables history view transitions.");
});
