/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Asserts that the currently active View is view.
 *
 * @param {View} view
 *   The View that is expected to be active.
 * @return {Promise}
 * @resolves {undefined}
 */
async function assertActiveView(view) {
  let activeView = await PinebuildTestUtils.getActiveView();
  Assert.equal(activeView, view, "Got expected active View.");
}

/**
 * Asserts that an executed function will cause a View to be activated.
 *
 * @param {View} view
 *   The View that is expected to be activated.
 * @param {function} taskFn
 *   A function that will be run to trigger View activation. This can be
 *   an async function.
 * @return {Promise}
 * @resolves {undefined}
 */
async function shouldActivate(view, taskFn) {
  let activation = BrowserTestUtils.waitForEvent(
    gStageManager,
    "ViewMoved",
    false,
    e => {
      return e.view == view;
    }
  );
  await taskFn();
  await activation;
  await assertActiveView(view);
}

/**
 * Tests that a staged View that isn't at the top of the River will be moved
 * to the top of the River ("activated") if the user does one of the following:
 *
 * 1. Clicks on the View
 * 2. Scrolls on the View
 * 3. Sends non-shortcut keyboard events to the View
 * 4. Waits for browser.river.activationTimeout ms
 */
add_task(async function test_ViewActivation() {
  let [view1, view2, view3, view4] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.com/browser/browser/components",
    "https://example.org/",
  ]);

  // Since view4 was the last View to load, it should start as "active".
  await assertActiveView(view4);

  // Let's start with clicking the mouse into the content area of view3 to
  // activate it.
  await PinebuildTestUtils.setCurrentView(view3);
  // view4 should still be active, even though we just staged view3.
  await assertActiveView(view4);
  await shouldActivate(view3, async () => {
    EventUtils.synthesizeMouseAtCenter(gBrowser.selectedBrowser, {});
  });

  // Now let's try scrolling the mouse in the content area of view2 to
  // activate it.
  await PinebuildTestUtils.setCurrentView(view2);
  // view3 should still be active, even though we just staged view2.
  await assertActiveView(view3);
  await shouldActivate(view2, async () => {
    await BrowserTestUtils.synthesizeMouse(
      null,
      10,
      10,
      {
        wheel: true,
        deltaY: -1,
        deltaMode: WheelEvent.DOM_DELTA_LINE,
      },
      gBrowser.selectedBrowser
    );
  });

  // Now let's try sending a key event to the content area of view2 to
  // activate it.
  await PinebuildTestUtils.setCurrentView(view1);
  // view2 should still be active, even though we just staged view1.
  await assertActiveView(view2);
  await shouldActivate(view1, async () => {
    await BrowserTestUtils.synthesizeKey(
      "KEY_Enter",
      {},
      gBrowser.selectedBrowser
    );
  });

  // After all of these activations, we should have reversed the initial order of
  // the views.
  PinebuildTestUtils.assertViewsAre([view4, view3, view2, view1]);

  // Let's also make sure that something like the Ctrl-Shift-Tab shortcut _doesn't_
  // cause activation to occur.
  let wentBack = PinebuildTestUtils.waitForSelectedView(view2);
  EventUtils.synthesizeKey("VK_TAB", {
    ctrlKey: true,
    shiftKey: true,
  });
  await wentBack;
  Assert.equal(gStageManager.currentView, view2, "Went back to view2");
  // But view1 should still be active, despite the keyboard interaction.
  await assertActiveView(view1);

  // Finally, let's try the timeout. To reduce intermittent issues, the timeout
  // activation is normally disabled while testing, so we have to re-enable it. We'll
  // also set it to something pretty short (50ms)
  await SpecialPowers.pushPrefEnv({
    set: [["browser.river.activationTimeout", 50]],
  });

  await shouldActivate(view3, async () => {
    await PinebuildTestUtils.setCurrentView(view3);
  });
});
