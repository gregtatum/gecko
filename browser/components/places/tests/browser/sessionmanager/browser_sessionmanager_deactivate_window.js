/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that a session is saved when a window is deactivated.
 */

const { SessionSaver } = ChromeUtils.import(
  "resource:///modules/sessionstore/SessionSaver.jsm"
);
const { TabStateFlusher } = ChromeUtils.import(
  "resource:///modules/sessionstore/TabStateFlusher.jsm"
);

const TEST_URL = "https://example.com/";

let win;
let win2;
let dateCheckpoint;
let sessionGuid;

add_task(async function setup() {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    if (win2) {
      await BrowserTestUtils.closeWindow(win2);
    }
    await promiseWindowClosedAndSessionSaved(win);
  });
});

add_task(async function test_save_after_switch() {
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

  await assertSession(
    (await SessionManager.query({ guid: sessionGuid, includePages: true }))[0],
    {
      sessionGuid,
      lastSavedAt: dateCheckpoint,
      data: {},
      // At this stage, no pages should have been saved.
      pages: [],
    }
  );

  dateCheckpoint = Date.now();

  // Manually force SessionStore to update the tabs. We do this, as it normally
  // happens in the background, but for this test we want to ensure up to date
  // data has been saved.
  await TabStateFlusher.flushWindow(win);

  // Open a new window, deactiving the current one.
  let savePromise = SessionManager.once("sessions-updated");
  win2 = await BrowserTestUtils.openNewBrowserWindow();
  await savePromise;

  await assertSavedSession(
    sessionGuid,
    [{ url: TEST_URL, position: 0 }],
    dateCheckpoint
  );
});
