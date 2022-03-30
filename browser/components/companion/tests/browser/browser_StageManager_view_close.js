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
  Assert.equal(gStageManager.views.length, 2, "Should be 2 views now");
  Assert.equal(
    gStageManager.currentView.url.spec,
    PAGE_2,
    "The current view is for the second page"
  );

  // Now close the original view. The original browser should get removed.
  let originalTab = gBrowser.getTabForBrowser(originalBrowser);
  let tabClose = BrowserTestUtils.waitForTabClosing(originalTab, "TabClose");
  gStageManager.closeView(view);
  await tabClose;

  Assert.equal(gStageManager.views.length, 1, "Should only be 1 view");
  Assert.equal(gBrowser.browsers.length, 1, "Should only be 1 browser");
  Assert.equal(
    gBrowser.selectedBrowser,
    newBrowser,
    "Second browser should still be staged"
  );
  Assert.ok(!originalBrowser.isConnected, "Original browser was removed");

  gStageManager.reset();
});

/**
 * Test that closing the last view associated with a browser
 * removes that browser from the window, even if that browser
 * has more than one nsISHEntry in its sessionHistory.
 */
add_task(async function test_remove_browser_on_last_view() {
  // We want to test the case where there are multiple browser elements
  // in the DOM, so we turn on delegation to make it easier to ensure
  // that a new browser gets created when a navigation occurs.
  await SpecialPowers.pushPrefEnv({
    set: [["browser.tabs.openNewTabForMostNavigations", true]],
  });

  let [view1, view2, view3, view4] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);

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

  // So there should be 5 views total now, split across two browser elements:
  // 4 views in the staged browser, and 1 view in the unstaged browser.

  Assert.equal(
    gBrowser.browsers.length,
    2,
    "Should have 2 browsers in the window"
  );

  Assert.equal(
    gStageManager.views.length,
    5,
    "Should have 5 views in the window"
  );

  gStageManager.closeView(view1);
  Assert.equal(gStageManager.views.length, 4, "Should be 4 views left");
  Assert.equal(gBrowser.browsers.length, 2, "Should still be 2 browsers");

  gStageManager.closeView(view3);
  Assert.equal(gStageManager.views.length, 3, "Should be 3 views left");
  Assert.equal(gBrowser.browsers.length, 2, "Should still be 2 browsers");

  gStageManager.closeView(view2);
  Assert.equal(gStageManager.views.length, 2, "Should be 2 views left");
  Assert.equal(gBrowser.browsers.length, 2, "Should still be 2 browsers");

  // Now close the last view associated with the staged browser.
  let tab = gBrowser.selectedTab;
  let tabSwitch = BrowserTestUtils.waitForEvent(gBrowser, "TabSwitchDone");
  let tabClose = BrowserTestUtils.waitForTabClosing(tab, "TabClose");
  gStageManager.closeView(view4);
  await tabClose;
  await tabSwitch;
  Assert.equal(gStageManager.views.length, 1, "Should be 1 view left");

  // tabbrowser will automatically create a new browser when the
  // last one is destroyed, so there should be one left, but it
  // won't be the original one.
  Assert.equal(gBrowser.browsers.length, 1, "Should only be 1 browser.");
  Assert.ok(!originalBrowser.isConnected, "Original browser was removed.");
  Assert.equal(
    gBrowser.selectedBrowser,
    newBrowser,
    "Second browser should now be staged"
  );
});
