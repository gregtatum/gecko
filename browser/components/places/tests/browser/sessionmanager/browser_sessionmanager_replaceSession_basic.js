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

let win;

add_task(async function setup() {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await promiseWindowClosedAndSessionSaved(win);
  });
});

add_task(async function test_replaceSession_set_aside_simple_session() {
  let originalSessionGuid = await testSetAsideSession(
    win,
    async () => {
      BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
      await BrowserTestUtils.browserLoaded(
        win.gBrowser.selectedBrowser,
        false,
        TEST_URL
      );
    },
    [{ url: TEST_URL, position: 0 }]
  );

  await replaceSession(win, originalSessionGuid, 1);

  Assert.equal(win.gBrowser.tabs.length, 1, "Should only have one tab open");

  Assert.equal(
    win.gBrowser.selectedTab.linkedBrowser.currentURI.spec,
    TEST_URL,
    "Should have loaded the expected URL"
  );
});
