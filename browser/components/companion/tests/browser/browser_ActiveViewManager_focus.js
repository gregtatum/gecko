/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that keyboard focus will follow ViewGroupElements that are
 * reordered in the River.
 */

add_task(async function test_ViewGroupElement_reorder_focus() {
  let [view1, view2] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.org/",
  ]);

  let viewGroupEls = await PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroupEls.length, 2, "There should be 2 ViewGroupElements.");
  Assert.equal(viewGroupEls[0].viewGroup.lastView, view1);
  Assert.equal(viewGroupEls[1].viewGroup.lastView, view2);
  Assert.equal(gStageManager.currentView, view2);

  // Now explicitly focus the first ViewGroupElement. We expect this to
  // remain focused even after the River is reordered.
  viewGroupEls[0].focus();

  let viewSelected = PinebuildTestUtils.waitForSelectedView(view1);
  EventUtils.synthesizeKey("VK_SPACE");
  await viewSelected;

  let viewMoved = BrowserTestUtils.waitForEvent(gStageManager, "ViewMoved");
  gStageManager.clearActivationTimer();
  gStageManager.activateCurrentView();
  await viewMoved;

  viewGroupEls = await PinebuildTestUtils.getViewGroups();
  Assert.equal(
    viewGroupEls.length,
    2,
    "There should still be 2 ViewGroupElements."
  );
  Assert.equal(viewGroupEls[0].viewGroup.lastView, view2);
  Assert.equal(viewGroupEls[1].viewGroup.lastView, view1);
  Assert.equal(gStageManager.currentView, view1);

  // Even after the reordering, we should find that the activeElement
  // in the shadowRoot is the ViewGroupElement we had originally focused
  // earlier.
  Assert.equal(
    viewGroupEls[1].containingShadowRoot.activeElement,
    viewGroupEls[1]
  );
});
