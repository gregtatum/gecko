/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Utility function that middle-clicks on a ViewGroup and waits until
 * a switch to another view has completed.
 *
 * @param {ViewGroup} viewGroup
 *   The ViewGroup to middle-click on.
 * @param {View} view
 *   The View that we should switch to after the middle-click closes
 *   the last-most View in the group.
 * @returns Promise
 * @resolves undefined
 */
async function assertMiddleClickClosesAndSwitchesTo(viewGroup, view) {
  let navigate = BrowserTestUtils.waitForLocationChange(
    gBrowser,
    view.url.spec
  );
  let viewClosed = BrowserTestUtils.waitForEvent(gStageManager, "ViewRemoved");
  EventUtils.synthesizeMouseAtCenter(viewGroup, { button: 1 }, window);
  await viewClosed;
  await navigate;
}

/**
 * Tests that if a ViewGroup is middle-clicked, the last view
 * in that group will be closed.
 */
add_task(async function test_middleclick() {
  let [
    view1,
    view2,
    view3,
    /* view4 unused */
  ] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/browser",
    "https://example.org/browser/browser/components",
  ]);
  let [, viewGroup2] = await PinebuildTestUtils.getViewGroups(window);
  Assert.ok(viewGroup2, "Found the example.org ViewGroup");

  // Let's make sure that a right mousebutton auxclick doesn't cause the
  // ViewGroup to close.
  let sawViewClosedEvent = false;
  let controller = new AbortController();
  BrowserTestUtils.waitForEvent(
    viewGroup2,
    "UserAction:ViewClosed",
    false,
    () => {
      sawViewClosedEvent = true;
    },
    false,
    controller.signal
  );
  EventUtils.synthesizeMouseAtCenter(viewGroup2, { button: 2 }, window);
  Assert.ok(
    !sawViewClosedEvent,
    "Should not have seen UserAction:ViewClosed event"
  );
  // Now tear down our event listener.
  controller.abort();

  await assertMiddleClickClosesAndSwitchesTo(viewGroup2, view3);
  await assertMiddleClickClosesAndSwitchesTo(viewGroup2, view2);

  let viewGroups = await PinebuildTestUtils.getViewGroups(window);
  Assert.equal(viewGroups.length, 1, "Only 1 ViewGroup left");
  await assertMiddleClickClosesAndSwitchesTo(viewGroups[0], view1);
});
