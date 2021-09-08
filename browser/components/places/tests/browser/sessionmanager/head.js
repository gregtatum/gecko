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
