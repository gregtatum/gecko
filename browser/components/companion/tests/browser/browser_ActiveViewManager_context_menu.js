/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for the context menu that can be opened on ViewGroups
 * within the ActiveViewManager.
 */

/**
 * Opens the ViewGroup context menu for the passed group.
 *
 * @param {ViewGroup} group
 *   The ViewGroup to open the context menu on.
 * @return Promise
 * @resolves {Element}
 *   Resolves with the menu DOM element once the popupshown event
 *   has fired.
 */
async function openContextMenu(group) {
  info("Opening context menu on a ViewGroup");

  let menu = group.ownerDocument.getElementById(
    "active-view-manager-context-menu"
  );

  let shown = BrowserTestUtils.waitForPopupEvent(menu, "shown");
  EventUtils.synthesizeMouseAtCenter(group, {
    type: "contextmenu",
  });
  await shown;
  return menu;
}

/**
 * Tests that individual Views and entire ViewGroups can be closed
 * from the context menu.
 */
add_task(async function test_context_menu_close_group() {
  let [view1] = await PinebuildTestUtils.loadViews(["https://example.com/"]);
  let [group] = await PinebuildTestUtils.getViewGroups();
  Assert.equal(group.viewGroup.length, 1);
  Assert.equal(group.viewGroup.at(0), view1);

  let menu = await openContextMenu(group);
  let closeGroupMenuItem = menu.querySelector(
    "#active-view-manager-context-menu-close-view-group"
  );
  Assert.ok(closeGroupMenuItem, "Should have found the Close View Group item.");
  Assert.equal(
    document.l10n.getAttributes(closeGroupMenuItem).args.viewCount,
    1,
    "Should reflect the right view count"
  );

  let contextMenuClosed = BrowserTestUtils.waitForPopupEvent(menu, "hidden");
  let viewClosed = BrowserTestUtils.waitForEvent(gStageManager, "ViewRemoved");
  menu.activateItem(closeGroupMenuItem);
  await viewClosed;
  await contextMenuClosed;

  let [view2, view3, view4] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.com/browser/browser/components",
  ]);
  [group] = await PinebuildTestUtils.getViewGroups();
  Assert.equal(group.viewGroup.length, 3);
  Assert.deepEqual([...group.viewGroup], [view2, view3, view4]);

  menu = await openContextMenu(group);
  Assert.equal(
    document.l10n.getAttributes(closeGroupMenuItem).args.viewCount,
    3,
    "Should reflect the right view count"
  );

  contextMenuClosed = BrowserTestUtils.waitForPopupEvent(menu, "hidden");
  let expectedTimes = 3;
  let viewGroupClosed = BrowserTestUtils.waitForEvent(
    gStageManager,
    "ViewRemoved",
    false,
    () => {
      return --expectedTimes == 0;
    }
  );
  menu.activateItem(closeGroupMenuItem);
  await viewGroupClosed;
  await contextMenuClosed;
});
