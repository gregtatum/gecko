/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for cleaning up session files.
 */

const TEST_URL = "https://example.com/";
const TEST_URL2 = "https://example.com/browser/";

let dateCheckpoint;
let sessionGuid;

add_setup(async function() {
  await clearSessionDatabase();
});

add_task(async function test_cleanup_session_data() {
  const startPoint = Date.now();
  // Run tests in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow();

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );
  sessionGuid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");

  dateCheckpoint = Date.now();

  await promiseWindowClosedAndSessionSaved(win);

  await assertSavedSession(
    sessionGuid,
    [{ url: TEST_URL, position: 0 }],
    dateCheckpoint
  );

  // Run cleanup on a time before the session was created and ensure nothing
  // was removed.
  await SessionManager.cleanup(startPoint - 1);
  await assertSavedSession(
    sessionGuid,
    [{ url: TEST_URL, position: 0 }],
    dateCheckpoint
  );

  // Now choose an expiration time that that should wipe out the session file.
  await SessionManager.cleanup(Date.now() + 1);
  await assertSessionData({
    guid: sessionGuid,
    lastSavedAt: dateCheckpoint,
    data: {},
  });
  // Ensure file was deleted.
  let exists = await IOUtils.exists(
    PathUtils.join(PathUtils.profileDir, "sessions", `${sessionGuid}.jsonlz4`)
  );
  Assert.ok(!exists, "Should have no session data file");
});
