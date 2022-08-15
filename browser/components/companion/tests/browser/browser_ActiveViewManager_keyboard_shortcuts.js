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

/**
 * Asserts that view history items (breadcrumbs):
 * load the correct view when using the keyboard,
 * and ensure focus is not pulled from the active view history item
 * when loading a view history item.
 */
add_task(async function test_view_history_keyboard_navigation() {
  // Reset the stage manager for a clean slate
  await gStageManager.reset();
  registerCleanupFunction(async () => {
    await gStageManager.reset();
  });

  /**
   * Helper function that tabs to and activates breadcrumb items
   * The function asserts if the correct breadcrumb has focus after
   * activating a view history item (breadcrumb).
   *
   * @param {HTMLElement} viewGroupEl The view group element that contains the breadcrumbs we want to check
   * @param {View} viewToWaitFor The expected view after activating the breadcrumb item
   * @param {number} indexOfViewToWaitFor The one-based index of the expected view for test logging
   * @param {string} navKeyChar Either " " or "KEY_Enter"
   */
  async function tabAndActivateHistoryItem(
    viewGroupEl,
    viewToWaitFor,
    indexOfViewToWaitFor,
    navKeyChar
  ) {
    let viewHistoryElements = Array.from(
      viewGroupEl.shadowRoot.querySelector(".view-history").children
    );
    let viewChanged = PinebuildTestUtils.waitForSelectedView(viewToWaitFor);
    EventUtils.synthesizeKey("VK_TAB", {});
    // Find the bread crumb that has keyboard focus, may not be the one
    // that is currently active
    let focusedBreadCrumb = viewGroupEl.shadowRoot.activeElement;
    // Since we're using view 1 through 4, fix the off by one due to zero-indexed arrays
    let focusedBreadCrumbIndex =
      viewHistoryElements.findIndex(item => item == focusedBreadCrumb) + 1;
    Assert.equal(
      focusedBreadCrumbIndex,
      indexOfViewToWaitFor,
      `View history item ${indexOfViewToWaitFor} should be focused after tabbing`
    );
    EventUtils.synthesizeKey(navKeyChar);

    await viewChanged;
    Assert.equal(
      gStageManager.currentView,
      viewToWaitFor,
      `Used breadcrumb navigation to view${indexOfViewToWaitFor}`
    );

    await viewGroupEl.updateComplete;

    focusedBreadCrumb = viewGroupEl.shadowRoot.activeElement;
    // Since we're using view 1 through 4, fix the off by one due to zero-indexed arrays
    focusedBreadCrumbIndex =
      viewHistoryElements.findIndex(item => item == focusedBreadCrumb) + 1;
    // Ensure that focus has not been pulled from the view history item (breadcrumb)
    Assert.equal(
      focusedBreadCrumbIndex,
      indexOfViewToWaitFor,
      `View history item ${indexOfViewToWaitFor} should be focused after loading view`
    );
  }
  /**
   * Helper function that runs the main assertion loop for this task.
   *
   * This function assumes there are four view history items associated with a view group.
   * The function will tab through each view history item and either use
   * the Enter key or the whitespace key to activate view history items.
   * The function also ensures focus is set correctly when navigating through
   * the view history items.
   *
   * @param {String} navKeyChar Either " " or "KEY_Enter"
   * @param {[View]} views
   */
  async function navigateThroughViews(navKeyChar, views) {
    let [view1, view2, view3, view4] = views;
    // Focus the active view group for easier task setup

    let viewGroupEls = await PinebuildTestUtils.getViewGroups();
    Assert.equal(viewGroupEls.length, 1, "Should only be a single ViewGroup");

    let viewGroupEl = viewGroupEls[0];
    Assert.ok(viewGroupEl.active);
    Assert.equal(gStageManager.currentView, view4, "Starting at view4");
    viewGroupEl.focus();

    await tabAndActivateHistoryItem(viewGroupEl, view1, 1, navKeyChar);
    await tabAndActivateHistoryItem(viewGroupEl, view2, 2, navKeyChar);
    await tabAndActivateHistoryItem(viewGroupEl, view3, 3, navKeyChar);
    await tabAndActivateHistoryItem(viewGroupEl, view4, 4, navKeyChar);
  }

  let [view1, view2, view3, view4] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.com/browser/browser/components",
    "https://example.com/browser/browser/components/aboutlogins",
  ]);

  // Start the main assertion loops.
  await navigateThroughViews("KEY_Enter", [view1, view2, view3, view4]);
  await navigateThroughViews(" ", [view1, view2, view3, view4]);
});
