/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/* Ensures that the companion can be opened. */
add_task(async function test_open_companion() {
  let helper = new CompanionHelper();
  await helper.closeCompanion();

  ok(
    !document.getElementById("companion-browser"),
    "There's no companion browser"
  );

  await helper.openCompanion();

  ok(
    document.getElementById("companion-browser"),
    "The companion has been opened"
  );

  info("waiting for the companion to initialize");
  await helper.companionReady;

  await helper.runCompanionTask(() => {
    ok(
      content.document.querySelector(".companion-main"),
      "The companion content is available"
    );

    let deckContent = content.document.querySelector("#content");
    ok(
      deckContent.childElementCount,
      "The companion contents have been populated"
    );
  });
});
