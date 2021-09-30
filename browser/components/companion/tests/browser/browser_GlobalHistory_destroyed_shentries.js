/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PAGE_1 = "https://example.com/";
const PAGE_2 = "https://example.org/";
const PAGE_3 = "http://mochi.test:8888/";

registerCleanupFunction(() => {
  // No matter what happens, blow away window history after this file runs
  // to avoid leaking state between tests.
  gGlobalHistory.reset();
});

/**
 * These tests ensure that navigating to a View mapping to a destroyed SHEntry
 * works properly and doesn't corrupt the stack of Views.
 *
 * A View can be mapped to a destroyed SHEntry when the associated <browser>
 * navigates back from an SHEntry, and then navigates forward to overwrite
 * that SHEntry.
 */

/**
 * This tests a destroyed SHEntry for a normal page load.
 */
add_task(async function test_destroyed_shentry() {
  gGlobalHistory.reset();

  let browser = gBrowser.selectedBrowser;

  let newViewCreated = PinebuildTestUtils.waitForNewView(browser, PAGE_1);
  BrowserTestUtils.loadURI(browser, PAGE_1);
  let view1 = await newViewCreated;

  newViewCreated = PinebuildTestUtils.waitForNewView(browser, PAGE_2);
  BrowserTestUtils.loadURI(browser, PAGE_2);
  let view2 = await newViewCreated;

  // Go back to the original View, and then load a new View within that
  // browser to overwrite the SHEntry for View 2.
  await PinebuildTestUtils.setCurrentView(view1);

  newViewCreated = PinebuildTestUtils.waitForNewView(browser, PAGE_3);
  BrowserTestUtils.loadURI(browser, PAGE_3);
  let view3 = await newViewCreated;

  PinebuildTestUtils.assertViewsAre([view1, view2, view3]);

  // Now go "back" to View 2 to try to revive the entry.
  info("Going back to View 2");
  await PinebuildTestUtils.goBack();

  PinebuildTestUtils.assertEqualViews(
    gGlobalHistory.currentView,
    view2,
    "Went back to View 2"
  );
  PinebuildTestUtils.assertViewsAre([view1, view2, view3]);
});

/**
 * This tests a destroyed SHEntry for a History.pushState load.
 */
add_task(async function test_destroyed_shentry() {
  gGlobalHistory.reset();

  let browser = gBrowser.selectedBrowser;

  let newViewCreated = PinebuildTestUtils.waitForNewView(browser, PAGE_1);
  BrowserTestUtils.loadURI(browser, PAGE_1);
  await newViewCreated;

  // Add 2 new Views using pushState, for a total of 3 Views.
  await SpecialPowers.spawn(browser, [], async () => {
    content.history.pushState("page2", "page2");
    content.history.pushState("page3", "page3");
  });

  Assert.equal(
    gGlobalHistory.views.length,
    3,
    "Should have 3 Views in the River"
  );

  info("Going back to page2 View");
  await PinebuildTestUtils.goBack();

  Assert.equal(
    gGlobalHistory.views.length,
    3,
    "Should still have 3 Views in the River"
  );

  // Having gone back to View 2, navigating forward should destroy
  // the SHEntry associated with View 3 while keeping View 3 around.

  info("Destroying View 3 SHEntry");
  await SpecialPowers.spawn(browser, [], async () => {
    content.history.pushState("page4", "page4");
  });

  Assert.equal(
    gGlobalHistory.views.length,
    4,
    "Should now have 4 Views in the River"
  );

  let views = gGlobalHistory.views;

  // Since View 3 has a destroyed SHEntry, going back to it should result
  // in the View reloading itself with a new SHEntry.
  info("Going back to View 3");
  await PinebuildTestUtils.goBack();
  Assert.equal(gGlobalHistory.currentView, views[2], "Should be at View 3");

  // Now move away from that reloaded View...
  info("Going forward to View 4");
  await PinebuildTestUtils.goForward();
  Assert.equal(gGlobalHistory.currentView, views[3], "Should be at View 4");

  // And then back again, and we should still have 4 Views.
  info("Going back to View 3");
  await PinebuildTestUtils.goBack();

  Assert.equal(
    gGlobalHistory.views.length,
    4,
    "Should still have 4 Views in the River"
  );

  Assert.equal(gGlobalHistory.currentView, views[2], "Should be at View 3");
});
