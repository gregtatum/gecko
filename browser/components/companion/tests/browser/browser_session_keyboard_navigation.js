/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/*
  This task ensures keyboard navigation works as expected for the
  "Last Session" card that appears in the "Browse" view.
  This also ensures the session card component itself is keyboard navigable.
*/
add_task(async function test_last_session_card_keyboard_navigation() {
  // Run test in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow({
    waitForTabURL: "about:flow-reset",
  });

  // Visit a page to create a session.
  BrowserTestUtils.loadURI(
    win.gBrowser.selectedBrowser,
    "https://example.com/"
  );
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    "https://example.com/"
  );
  // Set aside session so we get the option to restore our last session.
  await PinebuildTestUtils.setAsideSession(win);

  await CompanionHelper.whenReady(async helper => {
    await helper.selectCompanionTab("browse");
    await helper.runCompanionTask(async () => {
      // Find the last visible item in the browse list so we can focus it
      // in order to simplify keyboard navigation in this test.
      let companionDeck = content.document.querySelector("#companion-deck");
      let sessionCard = companionDeck.querySelector("e-session-card");
      let sessionCardToggle = sessionCard.querySelector(".session-card-toggle");
      let restoreButton = sessionCard.querySelector(".restore-button");
      let browseEntries = Array.from(
        companionDeck.querySelector("browse-list .browse").children
      );
      browseEntries = browseEntries.filter(item => !item.hidden);
      let lastEntry = browseEntries.at(-1);
      lastEntry.focus();

      EventUtils.synthesizeKey("KEY_Tab", {}, content);
      let activeElement = content.document.activeElement;
      is(
        activeElement,
        sessionCardToggle,
        "The session card toggle button should be focused"
      );
      is(
        sessionCard.getAttribute("aria-expanded"),
        "false",
        "Session card should not expand when toggle button is focused"
      );
      is(
        restoreButton.getAttribute("aria-hidden"),
        "true",
        "Session restore button should be hidden"
      );
      // Toggle the card so that it expands
      EventUtils.synthesizeKey("KEY_Enter", {}, content);
      ok(
        sessionCard.classList.contains("expanded"),
        "Session card should be expanded"
      );
      is(
        sessionCard.getAttribute("aria-expanded"),
        "true",
        `Session card should set the "aria-expanded" attribute to "true"`
      );
      // Restore button should receive focus after card is expanded
      activeElement = content.document.activeElement;
      is(
        activeElement,
        restoreButton,
        "Session restore button should be focused"
      );
      // Navigate back to toggle button and collapse the card

      EventUtils.synthesizeKey("KEY_Tab", { shiftKey: true }, content);
      activeElement = content.document.activeElement;
      is(
        activeElement,
        sessionCardToggle,
        "The toggle button should be focused again"
      );
      ok(
        sessionCard.classList.contains("expanded"),
        "Session card should still be expanded after navigating back to toggle button"
      );
      is(
        sessionCard.getAttribute("aria-expanded"),
        "true",
        `Session card should still have the "aria-expanded" attribute set to "true"`
      );
      EventUtils.synthesizeKey("KEY_Enter", {}, content);
      activeElement = content.document.activeElement;
      is(
        activeElement,
        sessionCardToggle,
        "The toggle button should still be focused after toggling the expanded card"
      );
      ok(
        !sessionCard.classList.contains("expanded"),
        "Session card should not be expanded"
      );
      is(
        sessionCard.getAttribute("aria-expanded"),
        "false",
        "Session card should not be expanded"
      );
      is(
        restoreButton.getAttribute("aria-hidden"),
        "true",
        "Session restore button should be hidden"
      );
    });
  }, win);
  await BrowserTestUtils.closeWindow(win);
});
