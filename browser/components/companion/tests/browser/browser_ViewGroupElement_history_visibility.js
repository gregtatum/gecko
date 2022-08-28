/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * When the breadcrumbs are "hidden", they're not actually fully
 * hidden - they're _nearly_ hidden with a low opacity in order to
 * allow them to still be keyboard focusable (which snaps them into
 * visibility). This means that we cannot use
 * BrowserTestUtils.is_hidden to test the visibility of the breadcrumbs
 * when they're "hidden". This helper function does that work
 * for us.
 *
 * @param {Element} historyEl
 *   The DOM node that contains the breadcrumbs for a ViewGroupElement.
 * @param {boolean} isVisible
 *   True if it's expected that the history items be fully visible. False
 *   if they should be "hidden".
 */
function assertBreadcrumbsVisible(historyEl, isVisible) {
  let style = window.getComputedStyle(historyEl);
  let opacity = parseFloat(style.opacity);
  if (isVisible) {
    Assert.equal(opacity, 1, "History items are visible.");
  } else {
    Assert.ok(opacity < 0.01, "History items are (effectively) hidden.");
  }
}

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

  let viewGroupEls = await PinebuildTestUtils.getViewGroupEls();
  Assert.equal(viewGroupEls.length, 1, "Expected a single ViewGroupElement.");
  let viewGroupEl = viewGroupEls[0];

  // Move focus and the mouse cursor into the content area.
  let browser = gBrowser.selectedBrowser;
  browser.focus();
  EventUtils.synthesizeMouseAtCenter(browser, { type: "mousemove" });

  await viewGroupEl.updateComplete;
  let history = viewGroupEl.shadowRoot.querySelector("[part=history]");
  let domain = viewGroupEl.shadowRoot.querySelector("[part=domain]");

  assertBreadcrumbsVisible(history, false);
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

  // The breadcrumbs should not yet be visible, since we haven't keyboard focused
  // to them yet.
  assertBreadcrumbsVisible(history, false);
  Assert.ok(!BrowserTestUtils.is_hidden(domain), "Domain should be visible.");

  // Okay, now tab into the breadcrumbs. This should make the breadcrumbs visible.
  EventUtils.synthesizeKey("VK_TAB", {});

  assertBreadcrumbsVisible(history, true);
  Assert.ok(BrowserTestUtils.is_hidden(domain), "Domain should be hidden.");

  // Now move focus back into the content area.
  browser.focus();
  await river.updateComplete;

  assertBreadcrumbsVisible(history, false);
  Assert.ok(!BrowserTestUtils.is_hidden(domain), "Domain should be visible.");

  // Now hover the main toolbar with the mouse.
  let navBar = document.getElementById("nav-bar");
  EventUtils.synthesizeMouseAtCenter(navBar, { type: "mousemove" });
  assertBreadcrumbsVisible(history, true);
  Assert.ok(BrowserTestUtils.is_hidden(domain), "Domain should be hidden.");

  // Click on the first breadcrumb now.
  let breadcrumb = viewGroupEl.shadowRoot.querySelector("button.history");
  let viewSelected = PinebuildTestUtils.waitForSelectedView(view1);
  EventUtils.synthesizeMouseAtCenter(breadcrumb, {});
  await viewSelected;

  EventUtils.synthesizeMouseAtCenter(browser, { type: "mousemove" });
  await river.updateComplete;
  assertBreadcrumbsVisible(history, false);
  Assert.ok(!BrowserTestUtils.is_hidden(domain), "Domain should be visible.");
  await gStageManager.reset();
});

/**
 * Tests that breadcrumbs don't stay visible after the Page Action Menu closes
 * due to a user action.
 */
add_task(async function test_breadcrumb_visibility_after_PAM() {
  await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/",
    "https://example.com/browser/components",
  ]);
  let viewGroupEls = await PinebuildTestUtils.getViewGroupEls(window);
  Assert.equal(viewGroupEls.length, 1, "There should be one total ViewGroups");

  let viewGroupEl = viewGroupEls[0];

  let history = viewGroupEl.shadowRoot.querySelector("[part=history]");
  let domain = viewGroupEl.shadowRoot.querySelector("[part=domain]");

  assertBreadcrumbsVisible(history, false);
  Assert.ok(!BrowserTestUtils.is_hidden(domain), "Domain should be visible.");

  let pam = await PinebuildTestUtils.openPageActionMenu(viewGroupEls[0]);
  let copyButton = pam.querySelector("#page-action-copy-url");

  let pamClosed = BrowserTestUtils.waitForEvent(pam, "popuphidden");
  EventUtils.synthesizeMouseAtCenter(copyButton, {}, window);
  await pamClosed;

  assertBreadcrumbsVisible(history, false);
  Assert.ok(!BrowserTestUtils.is_hidden(domain), "Domain should be visible.");
});
