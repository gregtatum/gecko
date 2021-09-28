/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const PAGE_1 = "https://example.com/";
const PAGE_2 = "https://example.org/";
const PAGE_3 = "http://mochi.test:8888/";

/**
 * Tests that navigating to a View mapping to a destroyed SHEntry works
 * properly and doesn't corrupt the stack of Views.
 *
 * A View can be mapped to a destroyed SHEntry when the associated <browser>
 * navigates back from an SHEntry, and then navigates forward to overwrite
 * that SHEntry.
 */

registerCleanupFunction(() => {
  // Blow away window history after this test to avoid leaking
  // state between tests.
  gGlobalHistory.reset();
});

add_task(async function test_destroyed_shentry() {
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
  let viewChangedPromise = BrowserTestUtils.waitForEvent(
    gGlobalHistory,
    "ViewChanged"
  );
  gGlobalHistory.goBack();
  await viewChangedPromise;

  PinebuildTestUtils.assertEqualViews(
    gGlobalHistory.currentView,
    view2,
    "Went back to View 2"
  );
  PinebuildTestUtils.assertViewsAre([view1, view2, view3]);
});
