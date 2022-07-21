/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URLS = [
  { uri: "https://invalid.com/", title: "Page 0" },
  { uri: "https://mochi.test/", title: "Page 1" },
  { uri: "https://example.org/", title: "Page 2" },
];

XPCOMUtils.defineLazyModuleGetters(this, {
  Interactions: "resource:///modules/Interactions.jsm",
});

let win;

add_setup(async function() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.pinebuild.snapshots.relevancy.enabled", false]],
  });

  await Interactions.reset();
  await PlacesUtils.history.clear();
  await PlacesTestUtils.addVisits(TEST_URLS);
  let created = Date.now() - 10000;
  for (let { uri, title } of TEST_URLS) {
    await Interactions.store.add({
      url: uri,
      title,
      documentType: Interactions.DOCUMENT_TYPE.GENERIC,
      totalViewTime: 0,
      typingTime: 0,
      keypresses: 0,
      scrollingTime: 0,
      scrollingDistance: 0,
      created_at: created,
      updated_at: created,
    });
    created += 1000;
  }
  await Interactions.store.flush();

  for (let test of TEST_URLS) {
    await Snapshots.add({
      url: test.uri,
      userPersisted: Snapshots.USER_PERSISTED.MANUAL,
    });
  }

  // Run test in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  BrowserTestUtils.loadURI(
    win.gBrowser.selectedBrowser,
    "https://example.com/"
  );
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    "https://example.com/"
  );

  // Disable the idle service and make sure Interactions is active.
  let idleService = Cc["@mozilla.org/widget/useridleservice;1"].getService(
    Ci.nsIUserIdleService
  );
  idleService.disabled = true;
  Interactions.observe("active");

  registerCleanupFunction(async () => {
    idleService.disabled = false;
    await BrowserTestUtils.closeWindow(win);
    await Snapshots.reset();
    await PlacesUtils.history.clear();
  });
});

/**
 * Tests that suggested snapshots are keyboard focusable
 */
add_task(async function testFocusableSnapshot() {
  await CompanionHelper.whenReady(async helper => {
    await helper.runCompanionTask(
      async urls => {
        let suggestedSnapshots = content.document.querySelector(
          "suggested-snapshot-list"
        );
        await ContentTaskUtils.waitForCondition(() => {
          let snapshots = Array.from(
            suggestedSnapshots.querySelectorAll("e-recommendation")
          );
          return snapshots.length == urls.length;
        }, "Should be the correct number of links displayed");
        let nowButton = content.document.getElementById(
          "companion-deck-button-now"
        );
        let firstSuggestedSnapshot = content.document.querySelector(
          ".snapshot-contents"
        );
        let optionsButton = content.document.querySelector(".options-button");
        nowButton.focus();
        is(
          content.document.activeElement,
          nowButton,
          "The Now button is currently focused"
        );
        // Tab to Browse button
        EventUtils.synthesizeKey("VK_TAB", {}, content);
        // Tab to first suggested snapshot
        EventUtils.synthesizeKey("VK_TAB", {}, content);
        is(
          content.document.activeElement,
          firstSuggestedSnapshot,
          "The suggested snapshot is keyboard focusable"
        );
        // Tab to options button
        EventUtils.synthesizeKey("VK_TAB", {}, content);
        is(
          content.document.activeElement,
          optionsButton,
          "The suggested snapshot options button is keyboard focusable"
        );
      },
      [TEST_URLS]
    );
    // Reset the companion's state
    await helper.reload();
  }, win);
});
