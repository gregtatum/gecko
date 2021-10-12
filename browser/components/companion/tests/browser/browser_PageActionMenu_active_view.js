/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Ensures that opening the Page Action Menu on a View doesn't
 * change the current Active View.
 */

const TEST_URL1 = "https://example.com/";
const TEST_URL2 = "https://example.com/browser/";
const TEST_URL3 = "https://example.com/browser/browser/";
const TEST_URL4 = "https://example.org/browser/";
const TEST_URL5 = "https://example.org/browser/";

add_task(async function test_PageActionMenu_active_view() {
  let [view1, view2, view3, view4, view5] = await PinebuildTestUtils.loadViews([
    TEST_URL1,
    TEST_URL2,
    TEST_URL3,
    TEST_URL4,
    TEST_URL5,
  ]);

  let viewGroups = PinebuildTestUtils.getViewGroups(window);

  Assert.equal(viewGroups.length, 2, "There should be two total ViewGroups");
  Assert.ok(
    viewGroups[1].hasAttribute("top"),
    "The second ViewGroup should be the Active ViewGroup"
  );
  Assert.deepEqual(
    viewGroups[1].views,
    [view4, view5],
    "View 4 and View 5should be in the Active ViewGroup"
  );

  // There's some awkward terminology confusion here. `activeView` really
  // means which one is `current`. The last View in the ViewGroup that has
  // the `top` attribute set (and is the last ViewGroup in the River) is
  // the one that is considered the "Active View". MR2-1040 will hopefully
  // clean this up.
  Assert.equal(
    viewGroups[1].activeView,
    view5,
    "The last View in the ViewGroup should be current."
  );

  let pam = await PinebuildTestUtils.openPageActionMenu(viewGroups[1]);
  Assert.deepEqual(
    viewGroups[1].views,
    [view4, view5],
    "The Active ViewGroup order does not change when opening the Page " +
      "Action Menu for the last View in the Active ViewGroup."
  );
  Assert.equal(gGlobalHistory.currentView, view5);
  await PinebuildTestUtils.closePageActionMenu(pam);

  // Now select the second-to-last breadcrumb in this ViewGroup,
  // and make sure that opening its Page Action Menu doesn't cause
  // the order to change.
  await PinebuildTestUtils.setCurrentView(view4);
  await PinebuildTestUtils.openPageActionMenu(viewGroups[1]);
  Assert.deepEqual(
    viewGroups[1].views,
    [view4, view5],
    "The Active ViewGroup order does not change when opening the Page " +
      "Action Menu for the second-last View in the Active ViewGroup."
  );
  Assert.equal(
    gGlobalHistory.currentView,
    view4,
    "Should not have changed the current View."
  );
  await PinebuildTestUtils.closePageActionMenu(pam);

  Assert.deepEqual(
    viewGroups[0].views,
    [view1, view2, view3],
    "The non-Active ViewGroup has the right order."
  );

  await PinebuildTestUtils.setCurrentView(view1);
  await PinebuildTestUtils.openPageActionMenu(viewGroups[0]);
  Assert.deepEqual(
    viewGroups[0].views,
    [view1, view2, view3],
    "The non-Active ViewGroup order does not change when opening the Page " +
      "Action Menu for the second-last View in the Active ViewGroup."
  );
  Assert.equal(
    gGlobalHistory.currentView,
    view1,
    "Should not have changed the current View."
  );
  await PinebuildTestUtils.closePageActionMenu(pam);
});
