/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that breadcrumbs are visible only when hovering the main toolbar,
 * or if the user is keyboard navigating through the ViewGroupElement.
 */
add_task(async function test_ViewGroupElement_visibility() {
  let [view1, , ,] = await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/",
    "https://example.com/browser/components",
  ]);

  let viewGroupEls = await PinebuildTestUtils.getViewGroups();
  Assert.equal(viewGroupEls.length, 1, "Expected a single ViewGroupElement.");
  let viewGroupEl = viewGroupEls[0];

  // Move focus and the mouse cursor into the content area.
  let browser = gBrowser.selectedBrowser;
  browser.focus();
  EventUtils.synthesizeMouseAtCenter(browser, { type: "mousemove" });

  await viewGroupEl.updateComplete;
  let history = viewGroupEl.shadowRoot.querySelector("[part=history]");
  let domain = viewGroupEl.shadowRoot.querySelector("[part=domain]");
  Assert.ok(
    BrowserTestUtils.is_hidden(history),
    "History breadcrumbs should be hidden."
  );
  Assert.ok(!BrowserTestUtils.is_hidden(domain), "Domain should be visible.");

  // Now keyboard focus into the ViewGroupElement...
  PinebuildTestUtils.forceFocus(
    document.getElementById("pinebuild-back-button")
  );
  EventUtils.synthesizeKey("VK_TAB", {});
  Assert.equal(Services.focus.focusedElement, viewGroupEl);

  // The River is what ultimately tells the ViewGroupElement that it's keyboard
  // focused, so we need to wait for that to go through it's update cycle.
  let river = document.querySelector("river-el");
  await river.updateComplete;

  Assert.ok(
    !BrowserTestUtils.is_hidden(history),
    "History breadcrumbs should be visible."
  );
  Assert.ok(BrowserTestUtils.is_hidden(domain), "Domain should be hidden.");

  // Now move focus back into the content area.
  browser.focus();
  await river.updateComplete;
  Assert.ok(
    BrowserTestUtils.is_hidden(history),
    "History breadcrumbs should be hidden."
  );
  Assert.ok(!BrowserTestUtils.is_hidden(domain), "Domain should be visible.");

  // Now hover the main toolbar with the mouse.
  let navBar = document.getElementById("nav-bar");
  EventUtils.synthesizeMouseAtCenter(navBar, { type: "mousemove" });
  Assert.ok(
    !BrowserTestUtils.is_hidden(history),
    "History breadcrumbs should be visible."
  );
  Assert.ok(BrowserTestUtils.is_hidden(domain), "Domain should be hidden.");

  // Click on the first breadcrumb now.
  let breadcrumb = viewGroupEl.shadowRoot.querySelector("button.history");
  let viewSelected = PinebuildTestUtils.waitForSelectedView(view1);
  EventUtils.synthesizeMouseAtCenter(breadcrumb, {});
  await viewSelected;

  EventUtils.synthesizeMouseAtCenter(browser, { type: "mousemove" });
  await river.updateComplete;
  Assert.ok(
    BrowserTestUtils.is_hidden(history),
    "History breadcrumbs should be hidden."
  );
  Assert.ok(!BrowserTestUtils.is_hidden(domain), "Domain should be visible.");
});
