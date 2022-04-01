/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

XPCOMUtils.defineLazyModuleGetters(this, {
  Interactions: "resource:///modules/Interactions.jsm",
  SnapshotGroups: "resource:///modules/SnapshotGroups.jsm",
  SnapshotMonitor: "resource:///modules/SnapshotMonitor.jsm",
});

let now = Date.now();
let TEST_URLS = [
  {
    url: "https://example.com/",
    created_at: now - 30000,
    updated_at: now - 30000,
  },
  {
    url: "https://example.com/",
    created_at: now - 20000,
    updated_at: now - 20000,
  },
  {
    url: "https://example.com/67890",
    created_at: now - 10000,
    updated_at: now - 10000,
  },
  {
    url: "https://example.com/135246",
    created_at: now - 30000,
    updated_at: now - 30000,
  },
  {
    url: "https://example.com/531246",
    created_at: now - 30000,
    updated_at: now - 30000,
  },
];

let win;

async function addInteractions(interactions) {
  await PlacesTestUtils.addVisits(interactions.map(i => i.url));

  for (let interaction of interactions) {
    await Interactions.store.add({
      url: interaction.url,
      title: interaction.title,
      documentType:
        interaction.documentType ?? Interactions.DOCUMENT_TYPE.GENERIC,
      totalViewTime: interaction.totalViewTime ?? 0,
      typingTime: interaction.typingTime ?? 0,
      keypresses: interaction.keypresses ?? 0,
      scrollingTime: interaction.scrollingTime ?? 0,
      scrollingDistance: interaction.scrollingDistance ?? 0,
      created_at: interaction.created_at || Date.now(),
      updated_at: interaction.updated_at || Date.now(),
      referrer: interaction.referrer || "",
    });
  }
  await Interactions.store.flush();
}

async function addInteractionsAndSnapshots(data) {
  for (let item of data) {
    await addInteractions([item]);
    await Snapshots.add({ url: item.url });
  }
}

add_setup(async function() {
  Services.prefs.setIntPref("browser.places.snapshots.minGroupSize", 4);
  await Snapshots.reset();
  await addInteractionsAndSnapshots(TEST_URLS);
  // Force trigger the builders to build a domain group.
  await SnapshotMonitor.observe(null, "idle-daily");

  // Run test in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URLS[0].url);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URLS[0].url
  );

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
    await Snapshots.reset();
    // Force trigger the builders to remove the domain group.
    await SnapshotMonitor.observe(null, "idle-daily");
    await PlacesUtils.history.clear();
  });
});

add_task(async function test_snapshot_groups_displayed() {
  await CompanionHelper.whenReady(async helper => {
    await helper.selectCompanionTab("browse");
    await helper.runCompanionTask(() =>
      content.document.querySelector("button.snapshot-groups").click()
    );
    let snapshotGroupsLength = await helper.runCompanionTask(
      () => content.document.querySelectorAll(".snapshot-group").length
    );
    Assert.equal(snapshotGroupsLength, 1, "Showing snapshot groups");
  }, win);
});

add_task(async function test_snapshot_group_titles() {
  await CompanionHelper.whenReady(async helper => {
    await helper.selectCompanionTab("browse");

    let group = (await SnapshotGroups.query())[0];
    let oldTitle = group.title;
    group.title = "User";
    // We must remove the "title" property from the group because otherwise we
    // end up having both a title and a fluentTitle in the metadata, that is a
    // not supported, nor expected, condition for groups.
    group.builderMetadata = {
      title: null,
      fluentTitle: { id: "snapshot-group-pinned-header" },
    };
    await SnapshotGroups.updateMetadata(group);
    registerCleanupFunction(async () => {
      group.builderMetadata = {
        title: oldTitle,
        fluentTitle: null,
      };
      await SnapshotGroups.updateMetadata(group);
    });

    await helper.runCompanionTask(async () => {
      content.document.querySelector("button.snapshot-groups").click();

      await ContentTaskUtils.waitForCondition(() => {
        let snapshotGroups = Array.from(
          content.document.querySelectorAll(".snapshot-group")
        );
        return snapshotGroups[0].querySelector(".title").textContent == "User";
      }, "Should prefer the title field of the group");
    });

    group.title = "";
    await SnapshotGroups.updateMetadata(group);

    let expectedTitle = await document.l10n.formatValue(
      "snapshot-group-pinned-header"
    );
    await helper.runCompanionTask(
      async expected => {
        content.document.querySelector("button.snapshot-groups").click();

        await ContentTaskUtils.waitForCondition(() => {
          let snapshotGroups = Array.from(
            content.document.querySelectorAll(".snapshot-group")
          );
          return (
            snapshotGroups[0].querySelector(".title").textContent == expected
          );
        }, "Should use the localisation if the title is not specified");
      },
      [expectedTitle]
    );
  }, win);
});
