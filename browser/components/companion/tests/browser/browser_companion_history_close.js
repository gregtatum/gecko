/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

add_setup(async () => {
  let helper = new CompanionHelper();
  await helper.companionReady;
  helper.openCompanion();
});

/**
 * Tests that the History tab, once revealed, can then be closed
 * via a close button in the corner of the section.
 */
add_task(async function test_history_panel_close() {
  let helper = new CompanionHelper();
  await helper.revealHistoryTab();
  await helper.runCompanionTask(async () => {
    let closeButton = content.document.querySelector(".history-section-close");
    Assert.ok(
      !ContentTaskUtils.is_hidden(closeButton),
      "Close button should be visible."
    );

    let deck = content.document.getElementById("companion-deck");
    let viewChanged = ContentTaskUtils.waitForEvent(deck, "view-changed");
    closeButton.click();
    await viewChanged;

    Assert.equal(
      deck.selectedViewName,
      "browse",
      "Browse panel should have been selected."
    );
    let historyTab = content.document.querySelector(".tab-button.history");
    Assert.ok(
      ContentTaskUtils.is_hidden(historyTab),
      "History tab should now be hidden."
    );
  });
});
