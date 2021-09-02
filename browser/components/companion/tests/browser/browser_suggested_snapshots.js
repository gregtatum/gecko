/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URL1 = "https://example.com/";
const TEST_URL2 = "https://invalid.com/";
const TEST_URL3 = "https://foo.com/";
const TEST_URL4 = "https://bar.com/";

const { FilterAdult } = ChromeUtils.import(
  "resource://activity-stream/lib/FilterAdult.jsm"
);

add_task(async function setup() {
  await PlacesTestUtils.addVisits([
    { uri: TEST_URL1, title: "Page 1" },
    { uri: TEST_URL2, title: "Page 2" },
    { uri: TEST_URL3, title: "Page 3" },
    { uri: TEST_URL4, title: "Page 4" },
  ]);
  await Snapshots.add({ url: TEST_URL1, userPersisted: true });

  registerCleanupFunction(async () => {
    await Snapshots.reset();
    await PlacesUtils.history.clear();
  });
});

add_task(async function test_suggested_snapshots_displayed() {
  await CompanionHelper.whenReady(async helper => {
    await helper.runCompanionTask(async () => {
      let suggestedSnapshots = content.document.querySelector(
        "e-suggested-snapshot-list"
      );

      await ContentTaskUtils.waitForCondition(() => {
        return suggestedSnapshots.querySelectorAll("e-snapshot").length == 1;
      }, "Should be one link displayed");

      let snapshots = suggestedSnapshots.querySelectorAll("e-snapshot");
      Assert.equal(snapshots[0].querySelector(".title").textContent, "Page 1");
    });

    await Snapshots.add({ url: TEST_URL2, userPersisted: true });

    await helper.runCompanionTask(async () => {
      let suggestedSnapshots = content.document.querySelector(
        "e-suggested-snapshot-list"
      );

      await ContentTaskUtils.waitForCondition(() => {
        return suggestedSnapshots.querySelectorAll("e-snapshot").length == 2;
      }, "Should be two links displayed");

      let snapshots = suggestedSnapshots.querySelectorAll("e-snapshot");
      // Most recent first, so these are in reverse order.
      Assert.equal(snapshots[0].querySelector(".title").textContent, "Page 2");
      Assert.equal(snapshots[1].querySelector(".title").textContent, "Page 1");
    });
  });
});

add_task(async function test_suggested_snapshots_filter_adult() {
  await CompanionHelper.whenReady(async helper => {
    FilterAdult.addDomainToList(TEST_URL3);
    await Snapshots.add({ url: TEST_URL3, userPersisted: true });
    await Snapshots.add({ url: TEST_URL4, userPersisted: true });

    await helper.runCompanionTask(async () => {
      let suggestedSnapshots = content.document.querySelector(
        "e-suggested-snapshot-list"
      );

      await ContentTaskUtils.waitForCondition(() => {
        return suggestedSnapshots.querySelectorAll("e-snapshot").length == 3;
      }, "Should be three links displayed");

      let snapshots = suggestedSnapshots.querySelectorAll("e-snapshot");
      // Most recent first, so these are in reverse order.
      Assert.equal(snapshots[0].querySelector(".title").textContent, "Page 4");
      Assert.equal(snapshots[1].querySelector(".title").textContent, "Page 2");
      Assert.equal(snapshots[2].querySelector(".title").textContent, "Page 1");
    });
    FilterAdult.removeDomainFromList(TEST_URL3);
  });
});
