/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for the context menu that can be opened on ViewGroups
 * within the ActiveViewManager.
 */

/**
 * Opens the ViewGroup context menu for the passed element.
 *
 * @param {Element} element
 *   The ViewGroupElement, or child of a ViewGroupElement, to open the
 *   context menu on.
 * @return Promise
 * @resolves {Element}
 *   Resolves with the menu DOM element once the popupshown event
 *   has fired.
 */
async function openContextMenu(element) {
  info("Opening context menu on a ViewGroup");

  let menu = element.ownerDocument.getElementById(
    "active-view-manager-context-menu"
  );

  let shown = BrowserTestUtils.waitForPopupEvent(menu, "shown");
  EventUtils.synthesizeMouseAtCenter(element, {
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
  let [viewGroupEl] = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(viewGroupEl.viewGroup.length, 1);
  Assert.equal(viewGroupEl.viewGroup.at(0), view1);

  let menu = await openContextMenu(viewGroupEl);
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
  [viewGroupEl] = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(viewGroupEl.viewGroup.length, 3);
  Assert.deepEqual([...viewGroupEl.viewGroup], [view2, view3, view4]);

  menu = await openContextMenu(viewGroupEl);
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
  await gStageManager.reset();
});

/**
 * Tests that the favicon-circle for a non-staged ViewGroupElement can be
 * used as the contextmenu target.
 */
add_task(async function test_favicon_circle_context_menu_target() {
  let [view1, view2] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.org/",
  ]);
  Assert.equal(
    gStageManager.currentView,
    view2,
    "The second View should be staged."
  );

  let viewGroupEls = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(viewGroupEls.length, 2, "There should be 2 ViewGroupElements.");
  Assert.ok(
    !viewGroupEls[0].active,
    "The first ViewGroupElement should not be active."
  );
  Assert.equal(viewGroupEls[0].viewGroup.length, 1);
  Assert.equal(viewGroupEls[0].viewGroup.at(0), view1);

  let viewIcon = viewGroupEls[0].shadowRoot.querySelector(".view-icon");
  let img = viewIcon.shadowRoot.querySelector("img");
  let menu = await openContextMenu(img);
  let contextMenuClosed = BrowserTestUtils.waitForPopupEvent(menu, "hidden");
  menu.hidePopup();
  await contextMenuClosed;
});
