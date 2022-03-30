/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that pinned Views can be closed correctly.
 */

/**
 * Test the case where there's only 1 View, and it's pinned.
 */
add_task(async function test_pinned_view_close_single() {
  let [view1] = await PinebuildTestUtils.loadViews(["https://example.com/"]);
  gStageManager.setViewPinnedState(view1, true);
  gStageManager.closeView(view1);

  Assert.equal(
    gStageManager.views.length,
    0,
    "Should have been able to close a single pinned View"
  );
  await BrowserTestUtils.waitForCondition(
    () => gStageManager.currentView === null,
    "currentView should be null"
  );
});

/**
 * Test the case where there are several pinned Views, and no other Views
 * in the River.
 */
add_task(async function test_pinned_view_close_only_multiple_pinned() {
  gStageManager.reset();
  let [view1, view2, view3, view4] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);
  gStageManager.setViewPinnedState(view1, true, false, 0);
  gStageManager.setViewPinnedState(view2, true, false, 1);
  gStageManager.setViewPinnedState(view3, true, false, 2);
  gStageManager.setViewPinnedState(view4, true, false, 3);

  await PinebuildTestUtils.setCurrentView(view1);

  let navigate = BrowserTestUtils.waitForLocationChange(
    gBrowser,
    view2.url.spec
  );
  let viewClosed = BrowserTestUtils.waitForEvent(gStageManager, "ViewRemoved");
  gStageManager.closeView(view1);
  await viewClosed;
  await navigate;

  Assert.equal(gStageManager.views.length, 3, "There should be 3 Views left.");
  Assert.equal(
    gStageManager.currentView,
    view2,
    "Should have chosen the next pinned View"
  );

  // With 3 Views, now choose the one at the end of the list, which should
  // be view4.
  PinebuildTestUtils.assertViewsAre([view2, view3, view4]);

  await PinebuildTestUtils.setCurrentView(view4);

  navigate = BrowserTestUtils.waitForLocationChange(gBrowser, view3.url.spec);
  viewClosed = BrowserTestUtils.waitForEvent(gStageManager, "ViewRemoved");
  gStageManager.closeView(view4);
  await viewClosed;
  await navigate;

  Assert.equal(gStageManager.views.length, 2, "There should be 2 Views left.");
  Assert.equal(
    gStageManager.currentView,
    view3,
    "Should have chosen the previous View"
  );
  PinebuildTestUtils.assertViewsAre([view2, view3]);

  await PinebuildTestUtils.setCurrentView(view2);

  navigate = BrowserTestUtils.waitForLocationChange(gBrowser, view3.url.spec);
  viewClosed = BrowserTestUtils.waitForEvent(gStageManager, "ViewRemoved");
  gStageManager.closeView(view2);
  await viewClosed;
  await navigate;

  Assert.equal(gStageManager.views.length, 1, "There should be 1 View left.");
  Assert.equal(
    gStageManager.currentView,
    view3,
    "Should have chosen the next View"
  );
  PinebuildTestUtils.assertViewsAre([view3]);

  viewClosed = BrowserTestUtils.waitForEvent(gStageManager, "ViewRemoved");
  gStageManager.closeView(view3);
  await viewClosed;
  Assert.equal(gStageManager.views.length, 0, "There should be 0 Views left.");
});

/**
 * Test the case where there are several pinned Views, and several Views
 * also in the River.
 */
add_task(async function test_pinned_view_close_river_and_multiple_pinned() {
  gStageManager.reset();

  let [view1, view2, view3, view4] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.com/browser/browser/components",
    "https://example.org/",
  ]);
  gStageManager.setViewPinnedState(view1, true, false, 0);
  gStageManager.setViewPinnedState(view2, true, false, 1);

  await PinebuildTestUtils.setCurrentView(view1);

  let navigate = BrowserTestUtils.waitForLocationChange(
    gBrowser,
    view2.url.spec
  );
  let viewClosed = BrowserTestUtils.waitForEvent(gStageManager, "ViewRemoved");
  gStageManager.closeView(view1);
  await viewClosed;
  await navigate;

  Assert.equal(gStageManager.views.length, 3, "There should be 3 Views left.");
  Assert.equal(
    gStageManager.currentView,
    view2,
    "Should have chosen the next pinned View"
  );

  PinebuildTestUtils.assertViewsAre([view2, view3, view4]);

  navigate = BrowserTestUtils.waitForLocationChange(gBrowser, view4.url.spec);
  viewClosed = BrowserTestUtils.waitForEvent(gStageManager, "ViewRemoved");
  gStageManager.closeView(view2);
  await viewClosed;
  await navigate;

  Assert.equal(gStageManager.views.length, 2, "There should be 2 Views left.");
  Assert.equal(
    gStageManager.currentView,
    view4,
    "Should have chosen the View at the end of the River"
  );
  PinebuildTestUtils.assertViewsAre([view3, view4]);
});
