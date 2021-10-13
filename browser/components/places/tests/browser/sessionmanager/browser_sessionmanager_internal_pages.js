/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for filtering out internal pages from a session.
 */

const TEST_URL = "https://example.org/";

let win;

add_task(async function setup() {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await promiseWindowClosedAndSessionSaved(win);
  });
});

add_task(async function test_internal_pages_not_saved() {
  let sessionGuid = await testSetAsideSession(
    win,
    async () => {
      BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
      await BrowserTestUtils.browserLoaded(
        win.gBrowser.selectedBrowser,
        false,
        TEST_URL
      );

      BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, "about:mozilla");
      await BrowserTestUtils.browserLoaded(
        win.gBrowser.selectedBrowser,
        false,
        "about:mozilla"
      );

      let chromeURL = getRootDirectory(gTestPath);
      await BrowserTestUtils.openNewForegroundTab(win.gBrowser, chromeURL);
    },
    [{ url: TEST_URL, position: 0 }]
  );

  // Check the session store file as well, the database is tested above.
  let data = await IOUtils.readJSON(
    PathUtils.join(
      await PathUtils.getProfileDir(),
      "sessions",
      `${sessionGuid}.jsonlz4`
    ),
    { decompress: true }
  );

  Assert.equal(data.tabs.length, 1, "Should only have saved data for one tab");
  Assert.equal(
    data.tabs[0].entries.length,
    1,
    "Should only have saved one entry on the tab"
  );
  Assert.equal(
    data.tabs[0].entries[0].url,
    TEST_URL,
    "Should have saved the expected url"
  );

  await testReplaceSession(win, sessionGuid, {
    tabs: [[TEST_URL]],
  });
});
