/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that the overflow menu can be activated via keyboard and that
 * the first item in the menu is focused when the overflow menu is opened.
 * Tests that the overflow menu can be opened via mouse and that
 * the first item in the menu is focused when the overflow menu is opened.
 */

add_task(async function test_open_overflow_view_menu() {
  gStageManager.reset();
  // Change the max view groups to one so that we can
  // get the overflow menu to appear with a minimum amount of views
  await SpecialPowers.pushPrefEnv({
    set: [["browser.river.maxGroups", 1]],
  });

  await PinebuildTestUtils.loadViews([
    "https://example.com/",
    "https://example.com/browser/browser",
    "https://example.org/",
  ]);

  // Focus the back button button and tab over to the overflow menu button.
  // Since the back button is a toolbar button, we have to set
  // a tabindex of -1 in order to focus it.
  //
  // A better path would be to focus the companion sidebar, but
  // setting a tabindex of -1 on the companion toggle button
  // doesn't work as expected on Mac.
  let backButton = document.getElementById("pinebuild-back-button");
  backButton.setAttribute("tabindex", "-1");
  backButton.focus();
  backButton.removeAttribute("tabindex");
  Assert.equal(
    document.activeElement,
    backButton,
    "Back button should be focused"
  );

  // Navigate to the overflow menu button
  let riverOverflow = document
    .querySelector("river-el")
    .shadowRoot.getElementById("river-overflow-button");
  EventUtils.synthesizeKey("VK_TAB");

  Assert.equal(
    document.activeElement,
    document.querySelector("river-el"),
    "The river element should be the document's active element"
  );
  Assert.equal(
    document.activeElement.shadowRoot.activeElement,
    riverOverflow,
    "The river overflow menu button should be focused"
  );

  let panelShown = BrowserTestUtils.waitForEvent(window, "popupshown");
  // Activate the overflow menu button which will open the panel
  // and focus the first item in the panel
  EventUtils.synthesizeKey("KEY_Enter");

  // Since the overflow panel does not exist until we activate it
  // we need to ensure the panel is open.
  let event = await panelShown;
  let overflowPanel = event.target;
  Assert.equal(
    overflowPanel.id,
    "active-view-manager-overflow-panel",
    "Opened the overflow panel."
  );
  // The first item in the panel should be focused
  let overflowList = overflowPanel.querySelectorAll("toolbarbutton");
  Assert.equal(
    document.activeElement,
    overflowList[0],
    "The first item in the overflow panel should be focused"
  );

  let popupHidden = BrowserTestUtils.waitForEvent(overflowPanel, "popuphidden");
  // Using the ESC key, the panel should close and focus should
  // be back on the overflow button
  EventUtils.synthesizeKey("VK_ESCAPE");
  await popupHidden;

  Assert.equal(
    document.activeElement,
    document.querySelector("river-el"),
    "The river element should be the document's active element after closing the overflow panel"
  );
  Assert.equal(
    document.activeElement.shadowRoot.activeElement,
    riverOverflow,
    "The river overflow menu button should be focused after closing the overflow panel"
  );

  panelShown = BrowserTestUtils.waitForEvent(window, "popupshown");
  // Click the overflow views button and
  // ensure the first view in the list is focused
  await EventUtils.synthesizeMouseAtCenter(riverOverflow, {}, window);
  await panelShown;

  // The first item in the panel should be focused
  overflowList = overflowPanel.querySelectorAll("toolbarbutton");
  Assert.equal(
    document.activeElement,
    overflowList[0],
    "The first item in the overflow panel should be focused"
  );

  popupHidden = BrowserTestUtils.waitForEvent(overflowPanel, "popuphidden");
  EventUtils.synthesizeKey("VK_ESCAPE");
  await popupHidden;

  Assert.equal(
    document.activeElement,
    document.querySelector("river-el"),
    "The river element should be the document's active element after closing the overflow panel"
  );
  Assert.equal(
    document.activeElement.shadowRoot.activeElement,
    riverOverflow,
    "The river overflow menu button should be focused after closing the overflow panel"
  );

  // Clean up task
  await SpecialPowers.popPrefEnv();
});
