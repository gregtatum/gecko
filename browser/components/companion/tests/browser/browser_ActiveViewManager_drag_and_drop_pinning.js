/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that ViewGroups can be dragged from the River into the
 * pinned Views region in the ActiveViewManager and back. Also
 * tests that pinned Views can be rearranged by dragging and
 * dropping.
 */

const TEST_URL1 = "https://example.com/";
const TEST_URL2 = "https://example.com/browser/";
const TEST_URL3 = "https://example.com/browser/browser/";
const TEST_URL4 = "https://example.org/browser/";
const TEST_URL5 = "https://example.org/browser/";

function simulateViewGroupDragAndEnd(viewGroup, destination) {
  // The VIEWGROUP_DROP_TYPE is a static member of the ActiveViewManager
  // customElement class, which happens to be exposed as a JS Module.
  // Unfortunately, it doesn't seem that I can import that JS Module
  // into this test scope at this time, so this seems like the only
  // way to access the static member for now in this test.
  let avm = document.querySelector("active-view-manager");
  const VIEWGROUP_DROP_TYPE = avm.constructor.VIEWGROUP_DROP_TYPE;

  EventUtils.synthesizeDrop(
    viewGroup,
    destination,
    [[{ type: VIEWGROUP_DROP_TYPE, data: viewGroup }]],
    null,
    window,
    window,
    { _domDispatchOnly: true }
  );
}

/**
 * Test that starting to drag a ViewGroup puts the pinned View elemtn
 * into the dragging state.
 */
add_task(async function test_pinned_views_dragging_state() {
  gGlobalHistory.reset();

  await PinebuildTestUtils.loadViews([TEST_URL1]);

  let river = document.querySelector("river-el");
  let pinnedViews = document.querySelector("pinned-views");

  // No matter what, make sure we exit the dragging state at the
  // end of this test.
  registerCleanupFunction(async () => {
    pinnedViews.dragging = false;
    await pinnedViews.updateComplete;
  });

  // Ensure that the River has finished rendering itself before
  // trying to drag and drop anything.
  await river.updateComplete;

  let viewGroups = PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroups.length, 1, "There should be 1 ViewGroup.");
  let viewGroup = viewGroups[0];

  let avm = document.querySelector("active-view-manager");
  const VIEWGROUP_DROP_TYPE = avm.constructor.VIEWGROUP_DROP_TYPE;

  let ds = Cc["@mozilla.org/widget/dragservice;1"].getService(
    Ci.nsIDragService
  );

  ds.startDragSessionForTests(
    Ci.nsIDragService.DRAGDROP_ACTION_MOVE |
      Ci.nsIDragService.DRAGDROP_ACTION_COPY |
      Ci.nsIDragService.DRAGDROP_ACTION_LINK
  );

  try {
    let [, dataTransfer] = EventUtils.synthesizeDragOver(
      viewGroup,
      river,
      [[{ type: VIEWGROUP_DROP_TYPE, data: viewGroup }]],
      null,
      window,
      window,
      { _domDispatchOnly: true }
    );
    Assert.ok(pinnedViews.dragging, "Pinned Views entered the dragging state.");

    EventUtils.sendDragEvent(
      { type: "dragend", dataTransfer, _domDispatchOnly: true },
      viewGroup
    );

    Assert.ok(!pinnedViews.dragging, "Pinned Views exited the dragging state.");
  } finally {
    ds.endDragSession(true);
  }
});

/**
 * Test that ViewGroups can be dragged to pin and unpin.
 */
add_task(async function test_drag_and_drop_pin_unpin() {
  gGlobalHistory.reset();

  let [view1, view2, view3, view4, view5] = await PinebuildTestUtils.loadViews([
    TEST_URL1,
    TEST_URL2,
    TEST_URL3,
    TEST_URL4,
    TEST_URL5,
  ]);

  let river = document.querySelector("river-el");
  let pinnedViews = document.querySelector("pinned-views");

  // Ensure that the River has finished rendering itself before
  // trying to drag and drop anything.
  await river.updateComplete;

  let viewGroups = PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroups.length, 2, "There should be 2 ViewGroups.");

  let dropTarget = pinnedViews.shadowRoot.querySelector("#pinned-views");

  // We have to reveal the pinned Views element before we can
  // simulate dragging and dropping to it.
  pinnedViews.dragging = true;
  await pinnedViews.updateComplete;
  registerCleanupFunction(async () => {
    pinnedViews.dragging = false;
    await pinnedViews.updateComplete;
  });

  Assert.equal(gGlobalHistory.currentView, view5, "view5 is on the stage.");
  Assert.ok(!view5.pinned, "view5 is not pinned.");

  // Drag the active ViewGroup, which should pin the last View (view5)
  // since that's what's current.
  simulateViewGroupDragAndEnd(viewGroups[1], dropTarget);
  await Promise.all([river.updateComplete, pinnedViews.updateComplete]);
  Assert.ok(view5.pinned, "view5 is pinned.");

  // Refresh our collection of unpinned Views now that we've changed
  // things, and drag one of the first non-Active Views over. This should
  // pin the last View in that ViewGroup, which is view3.
  viewGroups = PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroups.length, 2, "There should still be 2 ViewGroups.");
  Assert.ok(!view3.pinned, "view3 is not pinned.");
  simulateViewGroupDragAndEnd(viewGroups[0], dropTarget);
  await Promise.all([river.updateComplete, pinnedViews.updateComplete]);
  // Refresh our collection of unpinned and pinned Views now that we've
  // changed things again
  viewGroups = PinebuildTestUtils.getViewGroups();
  let pinnedViewGroups = PinebuildTestUtils.getPinnedViewGroups();

  Assert.ok(view3.pinned, "view3 is pinned.");

  // Since we dropped View 3 onto the pinned Views dropTarget, that
  // should have put it at the front of the pinned Views list.
  Assert.equal(
    pinnedViewGroups.length,
    2,
    "There should be 2 pinned ViewGroups."
  );

  Assert.equal(
    view3,
    pinnedViewGroups[0].lastView,
    "view3 should be the first pinned View."
  );
  Assert.equal(
    view5,
    pinnedViewGroups[1].lastView,
    "view5 should be the second pinned View."
  );

  // Let's change things up by dropping view4 on top of the last ViewGroup,
  // which contains view5. This should put view4 _after_ view5 in the
  // pinned View list, and also reduce the number of ViewGroups in the River
  // to 1.
  Assert.equal(viewGroups.length, 2, "There should still be 2 ViewGroups.");
  Assert.ok(!view4.pinned, "View 4 is not pinned.");

  simulateViewGroupDragAndEnd(viewGroups[1], pinnedViewGroups[1]);
  await Promise.all([river.updateComplete, pinnedViews.updateComplete]);
  Assert.ok(view4.pinned, "view4 is pinned.");

  // Refresh our collection of unpinned and pinned Views now that we've
  // changed things again
  viewGroups = PinebuildTestUtils.getViewGroups();
  pinnedViewGroups = PinebuildTestUtils.getPinnedViewGroups();

  Assert.equal(
    viewGroups.length,
    1,
    "There should only be 1 River ViewGroup now."
  );
  Assert.equal(
    pinnedViewGroups.length,
    3,
    "There should only be 3 pinned ViewGroups now."
  );

  // Okay, now let's drag some pinned Views back to the River. We'll
  // start by dragging the first pinned ViewGroup, which should be
  // view3. We'll make sure that view3 is staged and loaded to get
  // ahead of any extra River regrouping which might result from the
  // load occurring.
  await PinebuildTestUtils.setCurrentView(view3);

  // We have to wait for the River to regroup before we can trust
  // the ViewGroup count.
  let riverRegrouped = BrowserTestUtils.waitForEvent(river, "RiverRegrouped");
  simulateViewGroupDragAndEnd(pinnedViewGroups[0], viewGroups[0]);
  await riverRegrouped;
  await Promise.all([river.updateComplete, pinnedViews.updateComplete]);

  viewGroups = PinebuildTestUtils.getViewGroups();
  pinnedViewGroups = PinebuildTestUtils.getPinnedViewGroups();
  Assert.ok(!view3.pinned, "view3 is no longer pinned.");

  // Since view3 is same-domain as view1 and view2, it should have joined
  // the same ViewGroup, so there should only be 1 ViewGroup in the River.
  Assert.equal(
    viewGroups.length,
    1,
    "There should only be 1 ViewGroup in the River."
  );
  Assert.equal(
    viewGroups[0].lastView,
    view3,
    "view3 should be the active View"
  );

  Assert.equal(
    pinnedViewGroups.length,
    2,
    "There should only be 2 pinned ViewGroups now."
  );
  Assert.equal(
    view5,
    pinnedViewGroups[0].lastView,
    "view5 should be the first pinned View."
  );
  Assert.equal(
    view4,
    pinnedViewGroups[1].lastView,
    "view4 should be the second pinned View."
  );

  // Let's drag view4 back to the River now.
  await PinebuildTestUtils.setCurrentView(view4);
  riverRegrouped = BrowserTestUtils.waitForEvent(river, "RiverRegrouped");
  simulateViewGroupDragAndEnd(pinnedViewGroups[1], viewGroups[0]);
  await riverRegrouped;
  await Promise.all([river.updateComplete, pinnedViews.updateComplete]);

  viewGroups = PinebuildTestUtils.getViewGroups();
  pinnedViewGroups = PinebuildTestUtils.getPinnedViewGroups();
  Assert.ok(!view4.pinned, "view4 is no longer pinned.");

  // view4 is not same-origin as the other Views in the River, so
  // it'll get put into its own ViewGroup, meaning there should be
  // 2 ViewGroups in the River now.
  Assert.equal(
    viewGroups.length,
    2,
    "There should be 2 ViewGroups in the River."
  );
  Assert.equal(viewGroups[1].views.length, 1);
  Assert.equal(
    viewGroups[1].lastView,
    view4,
    "view4 should be the Active View."
  );

  Assert.equal(
    pinnedViewGroups.length,
    1,
    "There should only be 1 pinned ViewGroup now."
  );

  // Finally, let's drag view5 back to the River.
  await PinebuildTestUtils.setCurrentView(view5);
  riverRegrouped = BrowserTestUtils.waitForEvent(river, "RiverRegrouped");
  simulateViewGroupDragAndEnd(pinnedViewGroups[0], viewGroups[1]);
  await riverRegrouped;
  await Promise.all([river.updateComplete, pinnedViews.updateComplete]);

  viewGroups = PinebuildTestUtils.getViewGroups();
  pinnedViewGroups = PinebuildTestUtils.getPinnedViewGroups();
  Assert.ok(!view5.pinned, "view5 is no longer pinned.");

  // view5 is same origin as view4, so it should have been grouped
  // together with it, and there should still be only 2 ViewGroups
  // in the River.
  Assert.equal(
    viewGroups.length,
    2,
    "There should be 2 ViewGroups in the River."
  );
  Assert.equal(viewGroups[1].views.length, 2);
  Assert.equal(
    viewGroups[1].lastView,
    view5,
    "view5 should be the Active View."
  );

  Assert.equal(
    pinnedViewGroups.length,
    0,
    "There should be no pinned ViewGroups now."
  );

  // Now let's check the final order of the Views.
  PinebuildTestUtils.assertViewsAre([view1, view2, view3, view4, view5]);
});
