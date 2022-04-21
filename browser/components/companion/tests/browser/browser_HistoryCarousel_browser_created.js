/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the HistoryCarousel interface is exited from if a new
 * <browser> gets created for some reason.
 */
add_task(async function test_exit_on_browser_created() {
  // Temporarily re-enable thumbnails so that we capture the page previews.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pagethumbnails.capturing_disabled", false]],
  });

  await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
  ]);

  await PinebuildTestUtils.enterHistoryCarousel();
  let exited = PinebuildTestUtils.waitForHistoryCarouselExit();
  let {
    linkedBrowser: newBrowser,
  } = await BrowserTestUtils.openNewForegroundTab(
    gBrowser,
    "https://example.org/"
  );
  await exited;
  Assert.equal(gBrowser.selectedBrowser, newBrowser, "New browser is staged.");
});
