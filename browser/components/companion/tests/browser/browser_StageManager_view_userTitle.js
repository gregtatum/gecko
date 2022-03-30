/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that Views can have custom user titles set on them.
 */

/**
 * Test that when a View has a user title set on it, it also creates a snapshot
 * with that user title.
 */
add_task(async function test_user_title_snapshot() {
  registerCleanupFunction(async () => {
    await Snapshots.reset();
    await PlacesUtils.history.clear();
  });

  const URL = "https://example.com/";
  const CUSTOM_USER_TITLE = "This is my custom user title! Woohoo!";
  let [view1] = await PinebuildTestUtils.loadViews(["https://example.com/"]);
  Assert.notEqual(view1.title, CUSTOM_USER_TITLE);

  let observed = TestUtils.topicObserved("places-snapshots-added");
  gStageManager.setUserTitle(view1, CUSTOM_USER_TITLE);
  Assert.equal(
    view1.title,
    CUSTOM_USER_TITLE,
    "Should have set the custom title on the view"
  );

  let [, data] = await observed;
  Assert.deepEqual(
    [{ url: URL, userPersisted: Snapshots.USER_PERSISTED.MANUAL }],
    JSON.parse(data),
    "Should have seen the notification about the snapshot being added."
  );
  let snapshot = await Snapshots.get(URL);
  Assert.equal(
    snapshot.userPersisted,
    Snapshots.USER_PERSISTED.MANUAL,
    "User persistence reason of MANUAL should have been set."
  );
  Assert.equal(
    snapshot.title,
    CUSTOM_USER_TITLE,
    "Should create the Snapshot with the custom user title."
  );
});
