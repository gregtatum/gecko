/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Simulates pressing Ctrl-Tab with or without the Shift key.
 *
 * @param {object} args
 *   An set of named arguments for how the keyboard event should
 *   be dispatched.
 *
 *   {boolean} shiftKey
 *     True if the Shift key should be pressed.
 */
function pressCtrlTab({ shiftKey }) {
  EventUtils.synthesizeKey("VK_TAB", {
    ctrlKey: true,
    shiftKey,
  });
}

/**
 * Tests that the CYCLE_TABS keyboard shortcut sends the user forward and
 * backwards through the River in the ActiveViewManager.
 */
add_task(async function test_back_forward() {
  let [view1, view2, view3, view4] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.com/browser/browser/components",
    "https://example.org/",
  ]);

  Assert.equal(gStageManager.currentView, view4, "Starting at view4");

  let wentBack = PinebuildTestUtils.waitForSelectedView(view3);
  pressCtrlTab({ shiftKey: true });
  await wentBack;
  Assert.equal(gStageManager.currentView, view3, "Went back to view3");

  wentBack = PinebuildTestUtils.waitForSelectedView(view2);
  pressCtrlTab({ shiftKey: true });
  await wentBack;
  Assert.equal(gStageManager.currentView, view2, "Went back to view2");

  wentBack = PinebuildTestUtils.waitForSelectedView(view1);
  pressCtrlTab({ shiftKey: true });
  await wentBack;
  Assert.equal(gStageManager.currentView, view1, "Went back to view1");

  let wentFwd = PinebuildTestUtils.waitForSelectedView(view2);
  pressCtrlTab({ shiftKey: false });
  await wentFwd;
  Assert.equal(gStageManager.currentView, view2, "Went forward to view2");

  wentFwd = PinebuildTestUtils.waitForSelectedView(view3);
  pressCtrlTab({ shiftKey: false });
  await wentFwd;
  Assert.equal(gStageManager.currentView, view3, "Went forward to view3");

  wentFwd = PinebuildTestUtils.waitForSelectedView(view4);
  pressCtrlTab({ shiftKey: false });
  await wentFwd;
  Assert.equal(gStageManager.currentView, view4, "Went forward to view4");
});
