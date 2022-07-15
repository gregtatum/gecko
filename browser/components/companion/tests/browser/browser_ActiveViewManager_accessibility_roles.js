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
 *
 * While we're here, we also check that the following ARIA attributes are
 * set correctly:
 *
 * - aria-selected="true" (on the active ViewGroupElement)
 * - aria-label (set to the active or last View title for every ViewGroupElement)
 */
add_task(async function test_viewgroupelement_aria_states() {
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
    viewGroupEls[0].getAttribute("aria-label"),
    view4.title,
    "First ViewGroupElement should have its last View's title set as " +
      "aria-label."
  );
  Assert.equal(
    viewGroupEls[1].getAttribute("aria-label"),
    view5.title,
    "Last ViewGroupElement should have its sole View's title as aria-label."
  );

  Assert.equal(
    viewGroupEls[0].getAttribute("aria-expanded"),
    "false",
    "The first ViewGroupElement should have aria-expanded set to false " +
      "on it when inactive."
  );
  Assert.equal(
    viewGroupEls[0].getAttribute("aria-selected"),
    "false",
    "The first ViewGroupElement should have aria-selected set to false " +
      "on it when inactive."
  );
  Assert.ok(
    !viewGroupEls[1].hasAttribute("aria-expanded"),
    "The second ViewGroupElement should not have aria-expanded set on it " +
      "when active."
  );
  Assert.equal(
    viewGroupEls[1].getAttribute("aria-selected"),
    "true",
    "The second ViewGroupElement should have aria-expanded set to true on " +
      "it when active."
  );

  await PinebuildTestUtils.setCurrentView(view4);

  Assert.equal(
    viewGroupEls[0].getAttribute("aria-expanded"),
    "true",
    "The first ViewGroupElement should have aria-expanded set to true on " +
      "it when active."
  );
  Assert.equal(
    viewGroupEls[0].getAttribute("aria-selected"),
    "true",
    "The first ViewGroupElement should have aria-selected set to true " +
      "on it when active."
  );
  Assert.ok(
    !viewGroupEls[1].hasAttribute("aria-expanded"),
    "The second ViewGroupElement should not have aria-expanded set on it " +
      "when inactive."
  );
  Assert.equal(
    viewGroupEls[1].getAttribute("aria-selected"),
    "false",
    "The second ViewGroupElement should have aria-selected set to false " +
      "on it when inactive."
  );
  gStageManager.reset();
});

/**
 * Tests that ViewGroupElement's within the Pinned Views section get the right
 * aria-selected and aria-label set on them.
 */
add_task(async function test_pinned_viewgroupelement_aria_states() {
  let [view1, view2] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/",
  ]);

  // Pinning by default inserts at the front, so we'll insert view2
  // and then view1 to keep the view1, view2 order for ease of reading.
  gStageManager.setViewPinnedState(view2, true);
  gStageManager.setViewPinnedState(view1, true);

  Assert.equal(gStageManager.currentView, view2);

  let viewGroupEls = await PinebuildTestUtils.getPinnedViewGroups();
  Assert.equal(
    viewGroupEls.length,
    2,
    "There should be 2 pinned ViewGroupElements."
  );

  Assert.equal(
    viewGroupEls[0].getAttribute("aria-label"),
    view1.title,
    "First pinned ViewGroupElement should have the aria-label set to " +
      "the pinned View title."
  );
  Assert.equal(
    viewGroupEls[1].getAttribute("aria-label"),
    view2.title,
    "Second pinned ViewGroupElement should have the aria-label set to " +
      "the pinned View title."
  );

  // Since Pinned Views cannot have breadcrumbs, neither should have
  // aria-expanded set on them.
  Assert.ok(
    !viewGroupEls[0].hasAttribute("aria-expanded"),
    "The second ViewGroupElement should not have aria-expanded set on it " +
      "when inactive."
  );
  Assert.ok(
    !viewGroupEls[1].hasAttribute("aria-expanded"),
    "The second ViewGroupElement should not have aria-expanded set on it " +
      "when active."
  );

  Assert.equal(
    viewGroupEls[0].getAttribute("aria-selected"),
    "false",
    "The first ViewGroupElement should have aria-selected set to false " +
      "on it when inactive."
  );
  Assert.equal(
    viewGroupEls[1].getAttribute("aria-selected"),
    "true",
    "The second ViewGroupElement should have aria-expanded set to true on " +
      "it when active."
  );

  await PinebuildTestUtils.setCurrentView(view1);

  Assert.equal(
    viewGroupEls[0].getAttribute("aria-selected"),
    "true",
    "The first ViewGroupElement should have aria-selected set to true " +
      "on it when active."
  );
  Assert.equal(
    viewGroupEls[1].getAttribute("aria-selected"),
    "false",
    "The second ViewGroupElement should have aria-selected set to false " +
      "on it when inactive."
  );
  gStageManager.reset();
});
