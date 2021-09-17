/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for setting aside a session.
 */

const TEST_URL = "https://example.com/";
const TEST_URL2 = "https://example.com/browser/";
const TEST_URL3 = "https://example.com/browser/browser/";
const TEST_URL4 = "https://example.com/browser/browser/components/";

let win;

add_task(async function setup() {
  // Run tests in a new window to avoid affecting the main test window.
  win = await BrowserTestUtils.openNewBrowserWindow();

  registerCleanupFunction(async () => {
    await BrowserTestUtils.closeWindow(win);
  });
});

async function runSessionTest(loadPagesCallback, expectedPages) {
  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should not have an active session"
  );

  await loadPagesCallback();

  let sessionGuid = SessionStore.getCustomWindowValue(
    win,
    "SessionManagerGuid"
  );
  Assert.ok(sessionGuid, "Should have an active session");

  let dateCheckpoint = Date.now();
  await SessionManager.setAside(win);

  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should no longer have an active session"
  );

  Assert.equal(
    win.gGlobalHistory.views.length,
    0,
    "There should be no views in the global history."
  );

  let exists = await IOUtils.exists(
    PathUtils.join(
      await PathUtils.getProfileDir(),
      "sessions",
      `${sessionGuid}.jsonlz4`
    )
  );
  Assert.ok(exists, "Should have written a session data file");

  await assertSession((await SessionManager.query({ guid: sessionGuid }))[0], {
    sessionGuid,
    lastSavedAt: dateCheckpoint,
    data: {},
  });

  let fullSessionData = await SessionManager.query({
    guid: sessionGuid,
    includePages: true,
  });
  Assert.equal(fullSessionData.length, 1, "Should only be one session");
  await assertSession(fullSessionData[0], {
    sessionGuid,
    lastSavedAt: dateCheckpoint,
    data: {},
    pages: expectedPages,
  });

  return sessionGuid;
}

add_task(async function test_setAside_simple_session() {
  await runSessionTest(async () => {
    BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
    await BrowserTestUtils.browserLoaded(
      win.gBrowser.selectedBrowser,
      false,
      TEST_URL
    );
  }, [{ url: TEST_URL, position: 0 }]);
});

add_task(async function test_setAside_complex_session() {
  await runSessionTest(async () => {
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
  }, [
    { url: TEST_URL, position: 0 },
    { url: TEST_URL2, position: 1 },
    { url: TEST_URL3, position: 2 },
  ]);
});

let previousSessionGuid;

// This test saves the session guid for the next test to use.
add_task(async function test_setAside_reordered_session() {
  previousSessionGuid = await runSessionTest(async () => {
    let originalTab = win.gBrowser.selectedTab;

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

    let promise = BrowserTestUtils.waitForEvent(
      win.gGlobalHistory,
      "ViewMoved"
    );
    win.gBrowser.selectedTab = originalTab;
    await promise;
  }, [
    { url: TEST_URL, position: 0 },
    { url: TEST_URL3, position: 1 },
    { url: TEST_URL2, position: 2 },
  ]);
});

// This test effectively creates a new session, but overrides the guid
// with the one from the previous test, causing that session to be overwritten.
// This is a cheap way that we can set up an updated session with different data,
// to ensure the code works correctly.
add_task(async function test_setAside_updated_session() {
  await runSessionTest(async () => {
    BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL4);
    await BrowserTestUtils.browserLoaded(
      win.gBrowser.selectedBrowser,
      false,
      TEST_URL4
    );

    BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
    await BrowserTestUtils.browserLoaded(
      win.gBrowser.selectedBrowser,
      false,
      TEST_URL
    );

    SessionStore.setCustomWindowValue(
      win,
      "SessionManagerGuid",
      previousSessionGuid
    );
  }, [
    { url: TEST_URL4, position: 0 },
    { url: TEST_URL, position: 1 },
  ]);
});
