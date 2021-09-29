/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for replacing a session
 */

// The first two urls are intentionally different domains to force pages
// to load in different tabs.
const TEST_URL = "https://example.org/";
const TEST_URL2 = "https://example.com/";
const TEST_URL3 = "https://example.com/browser/";
const TEST_URL4 = "https://example.com/browser/browser/";

add_task(async function test_close_window() {
  // Run tests in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow();

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );
  let sessionGuid = SessionStore.getCustomWindowValue(
    win,
    "SessionManagerGuid"
  );

  let dateCheckpoint = Date.now();

  await promiseWindowClosedAndSessionSaved(win);

  await assertSavedSession(
    sessionGuid,
    [{ url: TEST_URL, position: 0 }],
    dateCheckpoint
  );
});
