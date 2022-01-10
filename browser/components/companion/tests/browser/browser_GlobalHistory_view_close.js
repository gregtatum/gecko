/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PAGE_1 = "https://example.com/";
const PAGE_2 = "https://example.org/";

/**
 * Test that closing the last view associated with a browser
 * removes that browser from the window.
 */
add_task(async function test_remove_browser_on_last_view() {
  // We want to test the case where there are multiple browser elements
  // in the DOM, so we turn on delegation to make it easier to ensure
  // that a new browser gets created when a navigation occurs.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.openNewTabForMostNavigations", true]],
  });

  let [view] = await PinebuildTestUtils.loadViews([PAGE_1]);

  Assert.equal(
    gBrowser.browsers.length,
    1,
    "Should have only 1 browser in the window"
  );

  let originalBrowser = gBrowser.selectedBrowser;

  // Now do a navigation that will cause a delegation and a new browser to be
  // created. We have to workaround the code in TopLevelNagigationDelegateChild
  // that intentionally doesn't delegate for navigations caused by the system
  // principal.
  let newBrowserPromise = BrowserTestUtils.waitForNewTab(
    gBrowser,
    PAGE_2,
    true
  );
  gBrowser.selectedBrowser.loadURI(PAGE_2, {
    triggeringPrincipal: Services.scriptSecurityManager.createNullPrincipal({}),
  });
  let { linkedBrowser: newBrowser } = await newBrowserPromise;

  Assert.equal(
    gBrowser.browsers.length,
    2,
    "Should have 2 browsers in the window"
  );
  Assert.equal(gGlobalHistory.views.length, 2, "Should be 2 views now");
  Assert.equal(
    gGlobalHistory.currentView.url.spec,
    PAGE_2,
    "The current view is for the second page"
  );

  // Now close the original view. The original browser should get removed.
  gGlobalHistory.closeView(view);
  Assert.equal(gGlobalHistory.views.length, 1, "Should only be 1 view");
  Assert.equal(gBrowser.browsers.length, 1, "Should only be 1 browser");
  Assert.equal(
    gBrowser.selectedBrowser,
    newBrowser,
    "Second browser should still be staged"
  );
  Assert.ok(!originalBrowser.isConnected, "Original browser was removed");
});
