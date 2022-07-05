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
});
