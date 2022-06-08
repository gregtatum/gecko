/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URLS = [
  { uri: "https://invalid.com/", title: "Page 0" },
  { uri: "https://mochi.test/", title: "Page 1" },
];

XPCOMUtils.defineLazyModuleGetters(this, {
  Interactions: "resource:///modules/Interactions.jsm",
});

let win;

add_setup(async function() {
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

  await Snapshots.add({
    url: TEST_URLS[0].uri,
    userPersisted: Snapshots.USER_PERSISTED.MANUAL,
  });
  await Snapshots.add({
    url: TEST_URLS[1].uri,
    userPersisted: Snapshots.USER_PERSISTED.MANUAL,
  });

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

add_task(async function test_dismiss() {
  await CompanionHelper.whenReady(async helper => {
    await helper.runCompanionTask(
      async urls => {
        let suggestedSnapshots = content.document.querySelector(
          "e-suggested-snapshot-list"
        );
        await ContentTaskUtils.waitForCondition(() => {
          let snapshots = Array.from(
            suggestedSnapshots.querySelectorAll("e-snapshot")
          );
          return snapshots.length == urls.length;
        }, "Should be the correct number of links displayed");

        info("Dismiss the first snapshot with dont-show");
        let snapshot = suggestedSnapshots.querySelectorAll("e-snapshot")[0];
        let dontShow = snapshot.lastElementChild.querySelector(
          "panel-item[data-action=dont-show"
        );
        Assert.ok(dontShow, "Found dontShow option");
        dontShow.button.click();
        await ContentTaskUtils.waitForCondition(() => {
          let snapshots = Array.from(
            suggestedSnapshots.querySelectorAll("e-snapshot")
          );
          return snapshots.length == urls.length - 1;
        }, "Should be the correct number of links displayed");

        info("Dismiss the second snapshot with not-relevant");
        snapshot = suggestedSnapshots.querySelectorAll("e-snapshot")[0];
        let notRelevant = snapshot.lastElementChild.querySelector(
          "panel-item[data-action=not-relevant"
        );
        Assert.ok(notRelevant, "Found notRelevant option");
        notRelevant.button.click();
        await ContentTaskUtils.waitForCondition(() => {
          let snapshots = Array.from(
            suggestedSnapshots.querySelectorAll("e-snapshot")
          );
          return snapshots.length == urls.length - 2;
        }, "Should be the correct number of links displayed");
      },
      [TEST_URLS]
    );
  }, win);

  // Check database values.
  let dismissedSnapshot = await Snapshots.get(TEST_URLS[1].uri, true);
  Assert.equal(
    dismissedSnapshot.removedReason,
    Snapshots.REMOVED_REASON.DISMISS
  );
  let notRelevantSnapshot = await Snapshots.get(TEST_URLS[0].uri, true);
  Assert.equal(
    notRelevantSnapshot.removedReason,
    Snapshots.REMOVED_REASON.NOT_RELEVANT
  );
});
