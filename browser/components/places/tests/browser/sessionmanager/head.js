/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

XPCOMUtils.defineLazyModuleGetters(this, {
  SessionManager: "resource:///modules/SessionManager.jsm",
  SessionStore: "resource:///modules/sessionstore/SessionStore.jsm",
});

/**
 * Asserts that the places database has the expected data stored for a
 * particular session.
 *
 * @param {object} expected
 * @param {string} expected.guid
 *   The guid of the session to check.
 * @param {number} expected.lastSavedAt
 *   The time the session was expected to be last saved at. Note the check
 *   for this ensures the session was saved at a time that is equal or later
 *   than the expected.
 * @param {object} expected.data
 *   Session associated data to check.
 */
async function assertSessionData(expected) {
  let session = await PlacesUtils.withConnectionWrapper(
    "head.js::assertSessionData",
    async db => {
      let rows = await db.execute(
        `SELECT * FROM moz_session_metadata WHERE guid = :guid`,
        { guid: expected.guid }
      );
      return rows.map(r => ({
        lastSavedAt: new Date(r.getResultByName("last_saved_at")),
        data: r.getResultByName("data"),
      }))[0];
    }
  );

  assertSession(session, expected);
}

/**
 * Asserts that a given session matches the expected one.
 *
 * @param {Session} session
 *   @see SessionManager.jsm
 * @param {object} expected
 * @param {string} expected.guid
 *   The guid of the session to check.
 * @param {number} expected.lastSavedAt
 *   The time the session was expected to be last saved at. Note the check
 *   for this ensures the session was saved at a time that is equal or later
 *   than the expected.
 * @param {object} expected.data
 *   Session associated data to check.
 * @param {object[]} expected.pages
 *   An expected list of pages in object format with keys of "url" and "position".
 */
async function assertSession(session, expected) {
  Assert.ok(session, "Should have returned a snapshot");
  Assert.greaterOrEqual(
    session.lastSavedAt.getTime(),
    expected.lastSavedAt,
    "Should have recorded a date more recent than the expected"
  );
  Assert.deepEqual(
    JSON.parse(session.data),
    expected.data,
    "Should have recorded the expected data"
  );
  if (expected.pages) {
    Assert.deepEqual(
      session.pages,
      expected.pages,
      "Should have recorded the expected page data"
    );
  }
}

/**
 * Clears the session database.
 */
async function clearSessionDatabase() {
  await PlacesUtils.withConnectionWrapper(
    "head.js::clearSessionDatabase",
    async db => {
      await db.execute("DELETE FROM moz_session_metadata");
    }
  );
}

/**
 * Tests setting aside a session and checks the window status and saved
 * data.
 *
 * @param {DOMWindow} win
 *   The window the test is operating within.
 * @param {function} loadPagesCallback
 *   A callback function that is called to load the pages for the session
 *   into the window.
 * @param {object[]} expectedPages
 *   An array of expected pages for the session. With properties url and
 *   position.
 * @returns {string}
 *   Returns the GUID of the session that was set aside.
 */
async function testSetAsideSession(win, loadPagesCallback, expectedPages) {
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
  let changeComplete = BrowserTestUtils.waitForEvent(
    win,
    "session-replace-complete"
  );
  win.document.getElementById("session-setaside-button").click();
  await changeComplete;

  Assert.ok(
    !SessionStore.getCustomWindowValue(win, "SessionManagerGuid"),
    "Should no longer have an active session"
  );

  Assert.equal(
    win.gGlobalHistory.views.length,
    0,
    "There should be no views in the global history"
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

/**
 * Tests replacing a session and checks the window status and tabs.
 *
 * @param {DOMWindow} win
 *   The window to restore into.
 * @param {string} guid
 *   The session guid to restore.
 * @param {object} expected
 *   Details of the pages expected to be restored.
 * @param {string[]} expected.tabs
 *   An array of URLs expected to be loaded in the tab.
 * @param {number} [expected.index]
 *   The expected index of the selected tab. If not provided, it is assumed
 *   to be the index of the last entry in the tabs array.
 */
async function testReplaceSession(win, guid, expected) {
  let expectedIndex = expected.index ?? expected.tabs.length - 1;

  let restoreComplete = BrowserTestUtils.waitForEvent(
    win,
    "SSWindowStateReady"
  );
  await SessionManager.replaceSession(win, guid);
  await restoreComplete;

  let numTabs = win.gBrowser.tabs.length;
  Assert.equal(
    numTabs,
    expected.tabs.length,
    "Should have the correct amount of tabs"
  );

  let expectedSelTab = expected.tabs[expectedIndex];

  // Wait for the selected tab to load.
  await BrowserTestUtils.browserLoaded(
    win.gBrowser.selectedTab.linkedBrowser,
    false,
    expectedSelTab[expectedSelTab.length - 1]
  );

  Assert.equal(
    win.gBrowser.tabs[expectedIndex],
    win.gBrowser.selectedTab,
    "Should have the expected tab selected"
  );

  for (let [i, expectedPages] of expected.tabs.entries()) {
    let tab = win.gBrowser.tabs[i];

    Assert.equal(
      tab.linkedBrowser.currentURI.spec,
      expectedPages[expectedPages.length - 1],
      `Should have the expected current URL in tab ${i}`
    );

    let sessionHistory = await SessionStore.getSessionHistory(tab);
    Assert.deepEqual(
      sessionHistory.entries.map(e => e.url),
      expectedPages,
      `Should have the correct pages stored for history in tab ${i}`
    );
  }
}
