/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that when View properties change via ViewUpdated, that
 * the representation of that View in the AVM is also updated.
 */

/**
 * Dispatches a TabAttrModified on a <tab> element with some
 * changed attributes as the detail.
 *
 * @param {Element} tab
 *   The tab to dispatch the event on.
 * @param {String[]} attrs
 *   An array of changed attribute keys. Example: "busy", "image".
 */
function dispatchTabAttrModified(tab, attrs) {
  let event = new CustomEvent("TabAttrModified", {
    bubbles: true,
    cancelable: false,
    detail: {
      changed: attrs,
    },
  });
  tab.dispatchEvent(event);
}

/**
 * Waits for a View to be in a particular busy state.
 *
 * @param {View} view
 *   The View to check for the busy state.
 * @param {boolean} isBusy
 *   True if the View should be in the busy state.
 * @return Promise
 * @resolves undefined
 */
async function waitForViewBusyState(view, isBusy) {
  if (view.busy == isBusy) {
    return;
  }

  await BrowserTestUtils.waitForEvent(gStageManager, "ViewUpdated", e => {
    e.view == view && e.view.busy == isBusy;
  });
}

/**
 * Waits for a View to have a particular iconURL.
 *
 * @param {View} view
 *   The View to check for the iconURL.
 * @param {String} iconURL
 *   The icon URL that is expected.
 * @return Promise
 * @resolves undefined
 */
async function waitForViewIconURL(view, iconURL) {
  if (view.iconURL == iconURL) {
    return;
  }

  await BrowserTestUtils.waitForEvent(gStageManager, "ViewUpdated", e => {
    e.view == view && e.view.iconURL == iconURL;
  });
}

/**
 * Checks the AVM state to ensure that the lone ViewGroup contains the
 * expected View and is in the expected isBusy state.
 *
 * @param {View} view
 *   The View to check for the busy state in the AVM.
 * @param {boolean} isBusy
 *   True if the ViewGroupElement should be showing the busy state.
 * @return Promise
 * @resolves undefined
 */
async function assertAVMBusyState(view, isBusy) {
  let viewGroupEls = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(viewGroupEls.length, 1, "Should only be 1 ViewGroup");
  Assert.equal(
    viewGroupEls[0].viewGroup.length,
    1,
    "Should only contain 1 View"
  );
  Assert.equal(
    viewGroupEls[0].viewGroup.lastView,
    view,
    "Should contain the expected View"
  );

  let rootEl = viewGroupEls[0].shadowRoot.querySelector(".view-el");
  Assert.equal(rootEl.hasAttribute("busy"), isBusy, "Got expected busy state.");
}

/**
 * Checks the AVM state to ensure that the lone ViewGroup contains the
 * expected View and has the expected iconURL.
 *
 * @param {View} view
 *   The View to check for the busy state in the AVM.
 * @param {String} iconURL
 *   The icon URL that is expected in the ViewGroupElement.
 * @return Promise
 * @resolves undefined
 */
async function assertAVMIconURL(view, iconURL) {
  let viewGroupEls = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(viewGroupEls.length, 1, "Should only be 1 ViewGroup");
  Assert.equal(
    viewGroupEls[0].viewGroup.length,
    1,
    "Should only contain 1 View"
  );
  Assert.equal(
    viewGroupEls[0].viewGroup.lastView,
    view,
    "Should contain the expected View"
  );

  let rootEl = viewGroupEls[0].shadowRoot.querySelector(".view-icon");
  Assert.equal(
    rootEl.getAttribute("src"),
    iconURL,
    "Got expected ViewGroup icon."
  );
}

/**
 * Simulates changes to the busy state and favicon for a View
 * and ensures that those changes are reflected in the AVM.
 */
add_task(async function test_view_properties() {
  let [view1] = await PinebuildTestUtils.loadViews(["https://example.com/"]);
  await waitForViewBusyState(view1, false);
  await assertAVMBusyState(view1, false);

  let tab = gBrowser.selectedTab;
  let browser = gBrowser.selectedBrowser;

  // We'll start by simulating changes to the busy state.
  let busyStateChange = waitForViewBusyState(view1, true);
  tab.setAttribute("busy", "true");
  dispatchTabAttrModified(tab, "busy");
  await busyStateChange;
  await assertAVMBusyState(view1, true);

  busyStateChange = waitForViewBusyState(view1, false);
  tab.removeAttribute("busy");
  dispatchTabAttrModified(tab, "busy");
  await busyStateChange;
  await assertAVMBusyState(view1, false);

  // And now we'll check for changes to the iconURL.
  const ICON_1 = "chrome://browser/skin/bookmark.svg";
  const ICON_2 = "chrome://browser/skin/bookmark-hollow.svg";

  let iconStateChange = waitForViewIconURL(view1, ICON_1);
  browser.mIconURL = ICON_1;
  dispatchTabAttrModified(tab, "image");
  await iconStateChange;
  await assertAVMIconURL(view1, ICON_1);

  iconStateChange = waitForViewIconURL(view1, ICON_2);
  browser.mIconURL = ICON_2;
  dispatchTabAttrModified(tab, "image");
  await iconStateChange;
  await assertAVMIconURL(view1, ICON_2);
});
