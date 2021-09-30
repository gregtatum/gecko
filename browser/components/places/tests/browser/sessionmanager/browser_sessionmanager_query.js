/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for querying sessions.
 */

const TEST_URL = "https://example.com/";
const TEST_URL2 = "https://example.com/browser/";

let dateCheckpoint;

add_task(async function setup() {
  await clearSessionDatabase();
});

add_task(async function test_query_with_active_session() {
  let win = await BrowserTestUtils.openNewBrowserWindow();

  dateCheckpoint = Date.now();
  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should not have an active session"
  );

  await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URL);

  let guid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  Assert.ok(guid, "Should have an active session");

  let sessions = await SessionManager.query();

  Assert.equal(sessions.length, 0, "Should be no sessions returned by default");

  sessions = await SessionManager.query({ includeActive: true });

  Assert.equal(sessions.length, 1, "Should be one session returned");
  Assert.equal(sessions[0].guid, guid, "Should have the expected guid");

  await promiseWindowClosedAndSessionSaved(win);
});

add_task(async function test_query_with_active_sessions_and_limit() {
  let win = await BrowserTestUtils.openNewBrowserWindow();

  await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URL);

  let guid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  Assert.ok(guid, "Should have an active session");

  // We now have 2 sessions in the database, create one more.
  let win2 = await BrowserTestUtils.openNewBrowserWindow();
  await BrowserTestUtils.openNewForegroundTab(win2.gBrowser, TEST_URL2);

  let guid2 = SessionStore.getCustomWindowValue(win2, "SessionManagerGuid");
  Assert.ok(guid2, "Should have an active session");

  await promiseWindowClosedAndSessionSaved(win2);

  // Now do the test.

  let sessions = await SessionManager.query({ limit: 2 });

  Assert.equal(
    sessions.length,
    2,
    "Should have returned a number of sessions matching the limit"
  );
  Assert.ok(
    sessions.every(s => s.guid != guid),
    "Should have not included the active session"
  );

  sessions = await SessionManager.query({ includeActive: true, limit: 2 });

  Assert.equal(
    sessions.length,
    2,
    "Should have returned a number of sessions matching the limit"
  );
  Assert.ok(
    sessions.some(s => s.guid == guid),
    "Should have included the active session (active session is second oldest of three)"
  );

  await promiseWindowClosedAndSessionSaved(win);
});
