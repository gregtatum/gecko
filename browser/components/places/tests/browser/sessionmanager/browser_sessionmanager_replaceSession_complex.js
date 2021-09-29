/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for replacing a session
 */

// The first two urls are intentionally different domains to force pages
// to load in different tabs.
const TEST_URL = "https://example.org/";
const TEST_URL2 = "https://example.com/browser/";
const TEST_URL3 = "https://example.com/browser/browser/";
const TEST_URL4 = "https://example.com/browser/browser/components/";

let win;

add_task(async function setup() {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await promiseWindowClosedAndSessionSaved(win);
  });
});

add_task(async function test_replaceSession_complex_session() {
  let complexSessionGuid = await testSetAsideSession(
    win,
    async () => {
      BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
      await BrowserTestUtils.browserLoaded(
        win.gBrowser.selectedBrowser,
        false,
        TEST_URL
      );

      BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL2);
      await BrowserTestUtils.browserLoaded(
        win.gBrowser.selectedBrowser,
        false,
        TEST_URL2
      );

      await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URL3);
    },
    [
      { url: TEST_URL, position: 0 },
      { url: TEST_URL2, position: 1 },
      { url: TEST_URL3, position: 2 },
    ]
  );

  await testReplaceSession(win, complexSessionGuid, {
    tabs: [[TEST_URL, TEST_URL2], [TEST_URL3]],
  });
});
