/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

XPCOMUtils.defineLazyModuleGetters(this, {
  Interactions: "resource:///modules/Interactions.jsm",
  SnapshotGroups: "resource:///modules/SnapshotGroups.jsm",
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

add_task(async function setup() {
  Services.prefs.setIntPref("browser.places.snapshots.minGroupSize", 4);
  await addInteractionsAndSnapshots(TEST_URLS);
  await SnapshotGroups.add(
    { title: "Test Group", builder: "domain" },
    TEST_URLS.map(d => d.url)
  );

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
