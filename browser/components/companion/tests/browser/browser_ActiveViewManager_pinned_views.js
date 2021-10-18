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
  gGlobalHistory.reset();

  let [, , view3] = await PinebuildTestUtils.loadViews([
    TEST_URL1,
    TEST_URL2,
    TEST_URL3,
  ]);

  let river = document.querySelector("river-el");

  gGlobalHistory.setViewPinnedState(view3, true, 0);

  // Ensure that the River has finished rendering
  await river.updateComplete;

  // Despite there being two items still in the River, there
  // should be no "top" ViewGroup.
  let viewGroups = PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroups.length, 1, "There should be 1 ViewGroup.");
  Assert.ok(
    !viewGroups[0].hasAttribute("top"),
    "Should not have the 'top' attribute."
  );
});
