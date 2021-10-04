/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const { ContentTaskUtils } = ChromeUtils.import(
  "resource://testing-common/ContentTaskUtils.jsm"
);

add_task(async function testPocketCardsDisplay() {
  let baseUrl = getRootDirectory(gTestPath).replace(
    "chrome://mochitests/content/",
    "https://example.com/"
  );
  let pocketUrl = baseUrl + "browser_pocket_response.json";
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.pocket.url", pocketUrl]],
  });

  await CompanionHelper.whenReady(async helper => {
    await helper.closeCompanion();
    await helper.openCompanion();

    await helper.runCompanionTask(async () => {
      // switch to the "Browse" view in the companion
      let deck = content.document.getElementById("companion-deck");
      let browseBtn = content.document.querySelector('[name="browse"]');
      let browseShown = ContentTaskUtils.waitForEvent(deck, "view-changed");
      browseBtn.click();
      await browseShown;

      let pocketList = content.document.querySelector("pocket-list");
      ok(pocketList, "List of pocket recommendations is visible");

      await ContentTaskUtils.waitForEvent(pocketList, "pocket-loaded");

      let pocketStories = pocketList.shadowRoot.querySelectorAll(
        "pocket-story"
      );
      is(pocketStories.length, 3, "Three pocket stories are shown");

      let pocketStory = pocketStories[0].shadowRoot.querySelector(
        ".pocket-story"
      );
      ok(pocketStory.querySelector("img"), "Pocket story displays an image");
      ok(pocketStory.querySelector(".title"), "Pocket story displays a title");
      ok(
        pocketStory.querySelector(".excerpt"),
        "Pocket story displays an excerpt"
      );
      ok(
        pocketStory.querySelector(".domain"),
        "Pocket story displays a domain"
      );
    });
  });
});
