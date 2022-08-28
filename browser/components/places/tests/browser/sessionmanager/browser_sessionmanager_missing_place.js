/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests that pages with no place entry (not yet loaded) are saved in the session.
 */

const TEST_URL = "https://example.org/";
const INVALID_URL = "https://sdkfgjgherjkuvhekvh.test/";

let win;

add_setup(async function() {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await promiseWindowClosedAndSessionSaved(win);
    Services.io.offline = false;
  });
});

add_task(async function test_unknown_pages_saved() {
  let sessionGuid = await testSetAsideSession(
    win,
    async () => {
      BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, INVALID_URL);
      await BrowserTestUtils.browserLoaded(
        win.gBrowser.selectedBrowser,
        false,
        INVALID_URL,
        true
      );

      await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URL);
    },
    [
      { url: INVALID_URL, title: null },
      { url: TEST_URL, title: "mochitest index /" },
    ]
  );

  await testReplaceSession(win, sessionGuid, {
    tabs: [[INVALID_URL], [TEST_URL]],
  });
});
