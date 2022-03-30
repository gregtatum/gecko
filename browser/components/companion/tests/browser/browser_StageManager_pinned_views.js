/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that Views can be pinned.
 */

/**
 * Test that a View can be pinned and that a snapshot gets created
 * for it.
 */
add_task(async function test_pinned_view() {
  registerCleanupFunction(async () => {
    await Snapshots.reset();
    await PlacesUtils.history.clear();
  });

  const URL = "https://example.com/";
  // First, delete any Snapshots for example.com that might already exist,
  // since other tests might have left one around.
  if (await Snapshots.get(URL)) {
    await Snapshots.delete(URL);
  }

  let [view1] = await PinebuildTestUtils.loadViews(["https://example.com/"]);
  let observed = TestUtils.topicObserved("places-snapshots-added");
  gStageManager.setViewPinnedState(view1, true);

  Assert.ok(view1.pinned, "View should now be pinned.");

  let [, data] = await observed;
  Assert.deepEqual(
    [{ url: URL, userPersisted: Snapshots.USER_PERSISTED.PINNED }],
    JSON.parse(data),
    "Should have seen the notification about the snapshot being added."
  );
  let snapshot = await Snapshots.get(URL);
  Assert.equal(
    snapshot.userPersisted,
    Snapshots.USER_PERSISTED.PINNED,
    "User persistence reason of PINNED should have been set."
  );
});
