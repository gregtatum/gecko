/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Basic session registration, set aside and restore tests.
 *
 * The tests in this file follow-on from each other, and are intended to give
 * a quick check that the overall system is working.
 *
 * Detailed functionality is checked in the other browser_sessionmanager_* tests.
 */

const TEST_URL = "https://example.com/";
const TEST_URL2 = "https://example.com/browser/";

let win;
let dateCheckpoint;
let sessionGuid;

add_task(async function setup() {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });
});

add_task(async function test_register_session() {
  dateCheckpoint = Date.now();
  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should not have an active session"
  );

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );

  sessionGuid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  Assert.ok(sessionGuid, "Should have an active session");

  await assertSessionData({
    guid: sessionGuid,
    lastSavedAt: dateCheckpoint,
    data: {},
  });

  await assertSession((await SessionManager.query({ guid: sessionGuid }))[0], {
    sessionGuid,
    lastSavedAt: dateCheckpoint,
    data: {},
  });
});

add_task(async function test_setAside() {
  dateCheckpoint = Date.now();
  await SessionManager.setAside(win);

  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should no longer have an active session"
  );

  await assertSession((await SessionManager.query({ guid: sessionGuid }))[0], {
    sessionGuid,
    lastSavedAt: dateCheckpoint,
    data: {},
  });

  Assert.equal(
    win.gGlobalHistory.views.length,
    0,
    "There should be no views in the global history."
  );
});

add_task(async function test_start_second_session() {
  let previousSessionGuid = sessionGuid;

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );

  sessionGuid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  Assert.ok(sessionGuid, "Should have an active session");
  Assert.notEqual(
    sessionGuid,
    previousSessionGuid,
    "Should have a different guid"
  );
});
