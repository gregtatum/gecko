/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

/**
 * Tests for different ways new session may begin.
 */

const TEST_URL = "https://example.com/";
const TEST_URL2 = "https://example.com/browser/";

const { sinon } = ChromeUtils.import("resource://testing-common/Sinon.jsm");

let dateCheckpoint;
let sessionGuids = [];

add_task(async function setup() {
  await clearSessionDatabase();
});

registerCleanupFunction(async () => {
  sinon.restore();
});

add_task(async function test_register_session_with_open_new_tab() {
  let win = await BrowserTestUtils.openNewBrowserWindow();

  dateCheckpoint = Date.now();
  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should not have an active session"
  );

  await BrowserTestUtils.openNewForegroundTab(win.gBrowser, TEST_URL);

  let guid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  Assert.ok(guid, "Should have an active session");
  sessionGuids.push(guid);

  await assertSessionData({
    guid,
    lastSavedAt: dateCheckpoint,
    data: {},
  });

  await promiseWindowClosedAndSessionSaved(win);
});

add_task(async function test_second_navigation_doesnt_restart() {
  let win = await BrowserTestUtils.openNewBrowserWindow();

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

  let guid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  Assert.ok(guid, "Should have an active session");
  sessionGuids.push(guid);

  await assertSessionData({
    guid,
    lastSavedAt: dateCheckpoint,
    data: {},
  });

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );

  Assert.equal(
    SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    guid,
    "Should keep the same session when navigating to subsequent pages"
  );

  await assertSessionData({
    guid,
    lastSavedAt: dateCheckpoint,
    data: {},
  });

  await promiseWindowClosedAndSessionSaved(win);
});

function getGUIDs() {
  return PlacesUtils.withConnectionWrapper(
    "head.js::assertSessionData",
    async db => {
      let rows = await db.execute(`SELECT guid FROM moz_session_metadata`);
      return rows.map(r => r.getResultByName("guid"));
    }
  );
}

add_task(async function test_two_consecutive_calls() {
  let win = await BrowserTestUtils.openNewBrowserWindow();

  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should not have an active session"
  );

  let guidCount = (await getGUIDs()).length;

  // Calling register consecutively should only record the first GUID.
  SessionManager.register(win, Services.io.newURI(TEST_URL));
  SessionManager.register(win, Services.io.newURI(TEST_URL));

  let guids = await getGUIDs();
  Assert.equal(
    guids.length,
    guidCount + 1,
    "Should have only registered one extra guid"
  );
  let guid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  sessionGuids.push(guid);

  Assert.ok(guids.includes(guid), "Should have stored the guid on the window");

  await BrowserTestUtils.closeWindow(win);
});

add_task(async function test_register_already_in_db() {
  let win = await BrowserTestUtils.openNewBrowserWindow();

  // There should be at least one guid in here from a previous test.
  let guids = await getGUIDs();
  Assert.ok(guids.length, "Should have at least one guid from a previous test");

  sinon.stub(SessionManager, "makeGuid").returns(guids[0]);

  SessionManager.register(win, Services.io.newURI(TEST_URL));

  let newGuids = await getGUIDs();

  Assert.deepEqual(
    guids,
    newGuids,
    "Should not have written any more GUIDs to the database"
  );
  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should have cleared the GUID from the window."
  );

  await promiseWindowClosedAndSessionSaved(win);

  sinon.restore();
});

add_task(async function test_internal_pages() {
  let win = await BrowserTestUtils.openNewBrowserWindow();

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, "about:mozilla");
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    "about:mozilla"
  );

  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should not have registered a session when loading an about: page"
  );

  let chromeURL = getRootDirectory(gTestPath);

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, chromeURL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    chromeURL
  );

  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should not have registered a session when loading a chrome: page"
  );

  BrowserTestUtils.loadURI(win.gBrowser.selectedBrowser, TEST_URL);
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedBrowser,
    false,
    TEST_URL
  );

  let guid = SessionStore.getCustomWindowValue(win, "SessionManagerGuid");
  Assert.ok(
    guid,
    "Should register a session when loading a normal page after internal pages"
  );
  sessionGuids.push(guid);

  await promiseWindowClosedAndSessionSaved(win);
});

add_task(async function test_session_query() {
  let sessions = await SessionManager.query();
  Assert.equal(
    sessions.length,
    sessionGuids.length,
    "Should have returned the expected amount of sessions"
  );

  sessionGuids.reverse();

  for (let i = 0; i++; i < sessionGuids.length) {
    Assert.equal(
      sessions[i].guid,
      sessionGuids[i],
      "Should have the GUIDS in the correct order"
    );
  }
});
