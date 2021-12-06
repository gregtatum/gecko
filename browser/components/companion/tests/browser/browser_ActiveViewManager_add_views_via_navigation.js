/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that top level navigation the in the Pro Client creates a new view in the Active View Manager.
 */

add_task(async function test_add_view_navigation() {
  gGlobalHistory.reset();

  let viewGroups = await PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroups.length, 0, "There should be no ViewGroups.");

  const TEST_URL =
    "http://example.com/browser/browser/components/companion/tests/browser/example.html";
  let [view] = await PinebuildTestUtils.loadViews([TEST_URL]);

  viewGroups = await PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroups.length, 1, "There should be 1 ViewGroup.");
  Assert.equal(viewGroups[0].lastView, view);

  let viewAddedPromise = BrowserTestUtils.waitForEvent(
    gGlobalHistory,
    "ViewAdded"
  );
  let browser = gBrowser.selectedTab.linkedBrowser;
  await BrowserTestUtils.synthesizeMouseAtCenter("#link-new-view", {}, browser);
  await viewAddedPromise;
  info("ViewAdded was dispatched by GlobalHistory");

  viewGroups = await PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroups.length, 1, "There should be 1 ViewGroup.");
  Assert.equal(viewGroups[0].lastView.url.spec, "https://example.com/");

  viewAddedPromise = BrowserTestUtils.waitForEvent(gGlobalHistory, "ViewAdded");
  await BrowserTestUtils.synthesizeMouseAtCenter(
    "#link-new-view-group",
    {},
    browser
  );
  await viewAddedPromise;
  viewGroups = await PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroups.length, 2, "There should be 2 ViewGroups.");
  Assert.equal(viewGroups[1].lastView.url.spec, "http://mochi.test:8888/");
});
