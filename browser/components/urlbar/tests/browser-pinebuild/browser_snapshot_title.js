/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/**
 * This tests the urlbar search for titled snapshots.
 */

const PAGES = [
  {
    url: "https://mozilla.org/one/",
    title: "Page one",
    snapshotTitle: "Snapshot one",
  },
  {
    url: "https://mozilla.org/two/",
    title: "Page two",
    snapshotTitle: "Snapshot two",
  },
];
add_setup(async function() {
  await PlacesUtils.history.clear();
  await PlacesUtils.bookmarks.eraseEverything();
  let now = Date.now();
  await addInteractions([
    // The updated_at values are forced to ensure unique times so that we can
    // retrieve the snapshots in the expected order.
    {
      url: PAGES[0].url,
      documentType: Interactions.DOCUMENT_TYPE.MEDIA,
      created_at: now - 30000,
      updated_at: now - 30000,
    },
    { url: PAGES[1].url, created_at: now - 20000, updated_at: now - 20000 },
  ]);
  await PlacesTestUtils.addVisits(
    PAGES.map(p => ({ uri: p.url, title: p.title }))
  );
  registerCleanupFunction(async () => {
    await Snapshots.reset();
    await PlacesUtils.history.clear();
  });
});

add_task(async function test_snapshot_search() {
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: "one",
  });
  let result = await UrlbarTestUtils.getDetailsOfResultAt(window, 1);
  Assert.equal(result.url, PAGES[0].url, "Check first result URL");
  Assert.equal(result.title, PAGES[0].title, "Check title is from history");

  info("Add a snapshot with a title to the first url");
  await Snapshots.add({ url: PAGES[0].url, title: PAGES[0].snapshotTitle });
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: "sna",
  });
  result = await UrlbarTestUtils.getDetailsOfResultAt(window, 1);
  Assert.equal(result.url, PAGES[0].url, "Check first result URL");
  Assert.equal(
    result.title,
    PAGES[0].snapshotTitle,
    "Check title is from the snapshot"
  );
});

add_task(async function test_snapshot_adaptive() {
  await UrlbarUtils.addToInputHistory(PAGES[1].url, "sna");
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: "sna",
  });
  let result = await UrlbarTestUtils.getDetailsOfResultAt(window, 1);
  Assert.equal(result.url, PAGES[1].url, "Check first result URL");
  Assert.equal(result.title, PAGES[1].title, "Check title is from history");

  info("Add a snapshot with a title to the second url");
  await Snapshots.add({ url: PAGES[1].url, title: PAGES[1].snapshotTitle });
  await UrlbarTestUtils.promiseAutocompleteResultPopup({
    window,
    value: "sna",
  });
  result = await UrlbarTestUtils.getDetailsOfResultAt(window, 1);
  Assert.equal(result.url, PAGES[1].url, "Check first result URL");
  Assert.equal(
    result.title,
    PAGES[1].snapshotTitle,
    "Check title is from the snapshot"
  );
});
