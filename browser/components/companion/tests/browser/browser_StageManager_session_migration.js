/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

const TEST_URL1 = "https://example.com/browser/";

const DEFAULT_WORKSPACE_ID = 0;
const PINNED_STATE = {
  NOT_PINNED: 0,
};

/**
 * Tests migrating the session state for StageManager from schema to
 * schema.
 */

/**
 * State version 1: all entries are given a "pinnedState" property set to
 * PINNED_STATE.NOT_PINNED (0)
 */
add_task(async function test_version_1() {
  let state = [
    { id: 2, cachedEntry: null, workspaceId: DEFAULT_WORKSPACE_ID },
    { id: 3, cachedEntry: null, workspaceId: DEFAULT_WORKSPACE_ID },
    { id: 4, cachedEntry: null, workspaceId: DEFAULT_WORKSPACE_ID },
    {
      id: 5,
      cachedEntry: { ID: 5, url: TEST_URL1 },
      workspaceId: DEFAULT_WORKSPACE_ID,
    },
    { id: 1, cachedEntry: null, workspaceId: DEFAULT_WORKSPACE_ID },
  ];

  gStageManager.migrateSessionState(state, 0);
  for (let entry of state) {
    Assert.equal(
      entry.pinnedState,
      PINNED_STATE.NOT_PINNED,
      "Entry had pinnedState PINNED_STATE.NOT_PINNED"
    );
  }
});
