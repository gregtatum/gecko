/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that ensure that the ActiveViewManager's UI components get
 * the right ARIA roles assigned to them in various states.
 */

/**
 * Tests that the River has the role of a tablist, and that a ViewGroupElement
 * has the role of a tab.
 */
add_task(async function test_tablist_tab_roles() {
  await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.org/",
  ]);

  let viewGroupEls = await PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroupEls.length, 2, "There should be 2 ViewGroupElements.");

  let river = document
    .querySelector("river-el")
    .shadowRoot.querySelector("#river");
  Assert.equal(
    river.getAttribute("role"),
    "tablist",
    "River should have a tablist role."
  );
  for (let viewGroupEl of viewGroupEls) {
    Assert.equal(
      viewGroupEl.getAttribute("role"),
      "tab",
      "ViewGroupElement should have a tab role."
    );
  }

  gStageManager.reset();
});

/**
 * Tests that ViewGroupElement's with history breadcrumbs have the
 * aria-expanded attribute set to true or false when active / inactive,
 * and that ViewGroupElement's containing only a single View do not have
 * that attribute set in either the active or inactive state.
 */
add_task(async function test_viewgroupelement_aria_expanded() {
  let [view1, view2, view3, view4, view5] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/",
    "https://example.com/browser/components",
    "https://example.com/browser/components/companion",
    "https://example.org/",
  ]);

  let viewGroupEls = await PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroupEls.length, 2, "There should be 2 ViewGroupElements.");
  Assert.equal(viewGroupEls[0].viewGroup.length, 4);
  for (let view of [view1, view2, view3, view4]) {
    Assert.ok(viewGroupEls[0].viewGroup.includes(view));
  }
  Assert.equal(viewGroupEls[1].viewGroup.length, 1);
  Assert.ok(viewGroupEls[1].viewGroup.includes(view5));

  Assert.equal(gStageManager.currentView, view5);
  Assert.equal(
    viewGroupEls[0].getAttribute("aria-expanded"),
    "false",
    "The first ViewGroupElement should have aria-expanded set to false " +
      "on it when inactive."
  );
  Assert.ok(
    !viewGroupEls[1].hasAttribute("aria-expanded"),
    "The second ViewGroupElement should not have aria-expanded set on it " +
      "when active."
  );

  await PinebuildTestUtils.setCurrentView(view4);

  Assert.equal(
    viewGroupEls[0].getAttribute("aria-expanded"),
    "true",
    "The first ViewGroupElement should have aria-expanded set to true on " +
      "it when active."
  );
  Assert.ok(
    !viewGroupEls[1].hasAttribute("aria-expanded"),
    "The second ViewGroupElement should not have aria-expanded set on it " +
      "when inactive."
  );

  gStageManager.reset();
});
