/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests the "Pin" / "Unpin" button in the Page Action Menu.
 */

const TEST_URL1 = "https://example.com/";

add_task(async function test_PageActionMenu_active_view() {
  let [view1] = await PinebuildTestUtils.loadViews([TEST_URL1]);
  let viewGroups = PinebuildTestUtils.getViewGroups(window);
  Assert.equal(viewGroups.length, 1, "There should be only 1 ViewGroup.");
  Assert.ok(
    viewGroups[0].hasAttribute("top"),
    "The ViewGroup should be the Active ViewGroup"
  );

  // There's some awkward terminology confusion here. `activeView` really
  // means which one is `current`. The last View in the ViewGroup that has
  // the `top` attribute set (and is the last ViewGroup in the River) is
  // the one that is considered the "Active View". MR2-1040 will hopefully
  // clean this up.
  Assert.equal(
    viewGroups[0].activeView,
    view1,
    "The last View in the ViewGroup should be current."
  );
  Assert.ok(!view1.pinned, "View should not started pinned.");

  let pam = await PinebuildTestUtils.openPageActionMenu(viewGroups[0]);
  let pinningToggle = pam.querySelector("#page-action-pin-view");

  Assert.equal(
    pinningToggle.dataset.l10nId,
    "page-action-toggle-pinning",
    "Correct L10n ID set on pinning toggle."
  );

  Assert.equal(
    document.l10n.getAttributes(pinningToggle).args.isPinned,
    "false",
    "Should not be showing the toggle in the isPinned state."
  );

  let pamClosed = BrowserTestUtils.waitForEvent(pam, "popuphidden");
  EventUtils.synthesizeMouseAtCenter(pinningToggle, {}, window);
  await pamClosed;

  Assert.ok(view1.pinned, "View should now be pinned.");

  viewGroups = PinebuildTestUtils.getPinnedViewGroups(window);
  Assert.equal(viewGroups.length, 1, "Should be 1 pinned ViewGroup.");

  pam = await PinebuildTestUtils.openPageActionMenu(viewGroups[0]);

  Assert.equal(
    pinningToggle.dataset.l10nId,
    "page-action-toggle-pinning",
    "Correct L10n ID set on pinning toggle."
  );

  Assert.equal(
    document.l10n.getAttributes(pinningToggle).args.isPinned,
    "true",
    "Should be showing the toggle in the isPinned state."
  );

  pamClosed = BrowserTestUtils.waitForEvent(pam, "popuphidden");
  EventUtils.synthesizeMouseAtCenter(pinningToggle, {}, window);
  await pamClosed;

  Assert.ok(!view1.pinned, "View should no longer be pinned.");
});
