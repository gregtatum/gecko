/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the AVM can construct a menu to represent the full set of
 * Views within a ViewGroupElement. This is useful for screenreader users,
 * primarily.
 */
add_task(async function test_history_menu() {
  let views = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/",
    "https://example.com/browser/browser/",
    "https://example.com/browser/browser/components",
  ]);

  let viewGroupEls = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(
    viewGroupEls.length,
    1,
    "All views should be grouped into a single ViewGroup."
  );

  let viewGroupEl = viewGroupEls[0];
  viewGroupEl.focus();
  await viewGroupEl.updateComplete;

  let popupPromise = BrowserTestUtils.waitForEvent(window, "popupshown");
  EventUtils.synthesizeKey("VK_DOWN");
  let event = await popupPromise;
  let menupopup = event.target;
  let menuitems = Array.from(menupopup.children);

  Assert.equal(views.length, menuitems.length);
  for (let i = 0; i < menuitems.length; ++i) {
    Assert.equal(menuitems[i].view, views[i]);
  }

  // Now let's test that changing to one of them will switch the
  // selected view.
  let previousViewSelected = PinebuildTestUtils.waitForSelectedView(views[2]);
  let popupClosed = BrowserTestUtils.waitForEvent(menupopup, "popuphidden");
  EventUtils.synthesizeKey("VK_UP");
  EventUtils.synthesizeKey("VK_RETURN");
  await popupClosed;
  await previousViewSelected;
});
