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

let sessionGuid;

function getSessionLastSavedAt(guid) {
  return PlacesUtils.withConnectionWrapper(
    "head.js::assertSessionData",
    async db => {
      let rows = await db.execute(
        `SELECT last_saved_at FROM moz_session_metadata WHERE guid = :guid`,
        { guid }
      );
      return rows[0].getResultByName("last_saved_at");
    }
  );
}

add_setup(async function() {
  await SpecialPowers.pushPrefEnv({
    set: [["browser.sessionstore.interval", 200]],
  });
});

add_task(async function test_close_window() {
  // Run tests in a new window to avoid affecting the main test window.
  let win = await BrowserTestUtils.openNewBrowserWindow();

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );
  sessionGuid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");

  let dateCheckpoint = Date.now();

  await promiseWindowClosedAndSessionSaved(win);

  await assertSavedSession(
    sessionGuid,
    [{ url: TEST_URL, position: 0 }],
    dateCheckpoint
  );
});

add_task(async function test_close_tabs() {
  let sessionTime = await getSessionLastSavedAt(sessionGuid);

  // Open and close two tabs to check that previous sessions do not get updated.
  let promiseObserved = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  let tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_URL);
  BrowserTestUtils.removeTab(tab);

  await promiseObserved;
  await TestUtils.waitForTick();

  promiseObserved = TestUtils.topicObserved(
    "sessionstore-closed-objects-changed"
  );
  tab = await BrowserTestUtils.openNewForegroundTab(gBrowser, TEST_URL2);
  BrowserTestUtils.removeTab(tab);

  await promiseObserved;
  await TestUtils.waitForTick();

  await assertSavedSession(
    sessionGuid,
    [{ url: TEST_URL, position: 0 }],
    sessionTime
  );

  Assert.equal(
    await getSessionLastSavedAt(sessionGuid),
    sessionTime,
    "Should not have updated the session time."
  );
});
