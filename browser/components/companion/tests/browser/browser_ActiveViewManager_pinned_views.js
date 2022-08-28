/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests behaviours of pinned Views in the ActiveViewManager.
 */

const TEST_URL1 = "https://example.com/";
const TEST_URL2 = "https://example.com/browser/";
const TEST_URL3 = "https://example.com/browser/browser/";

/**
 * Test that selecting a pinned View collapses the items in the
 * River so that no "top" View is displayed.
 */
add_task(async function test_no_top_view() {
  await gStageManager.reset();

  let [, , view3] = await PinebuildTestUtils.loadViews([
    TEST_URL1,
    TEST_URL2,
    TEST_URL3,
  ]);

  gStageManager.setViewPinnedState(view3, true, 0);

  // Despite there being two items still in the River, there
  // should be no "top" ViewGroup.
  let viewGroupEls = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(viewGroupEls.length, 1, "There should be 1 ViewGroup.");
  Assert.ok(
    !viewGroupEls[0].hasAttribute("top"),
    "Should not have the 'top' attribute."
  );
  await gStageManager.reset();
});

/**
 * Test that pinning multiple Views from the same domain does not group
 * them.
 */
add_task(async function test_never_group_pinned_views() {
  const TEST_URL_1 = "https://example.com/";
  const TEST_URL_2 = "https://example.com/browser/browser/";

  let [view1, view2] = await PinebuildTestUtils.loadViews([
    TEST_URL_1,
    TEST_URL_2,
  ]);
  gStageManager.setViewPinnedState(view1, true);
  gStageManager.setViewPinnedState(view2, true);

  Assert.ok(view1.pinned, "View 1 should now be pinned.");
  Assert.ok(view2.pinned, "View 2 should now be pinned.");

  let viewGroupsEls = await PinebuildTestUtils.getPinnedViewGroupEls();
  Assert.equal(viewGroupsEls.length, 2, "There should be 2 ViewGroups");
  Assert.equal(
    viewGroupsEls[0].viewGroup.length,
    1,
    "There is only 1 View in the ViewGroup"
  );
  Assert.equal(
    viewGroupsEls[1].viewGroup.length,
    1,
    "There is only 1 View in the ViewGroup"
  );
});
