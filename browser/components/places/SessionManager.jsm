/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["SessionManager"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.jsm",
  Services: "resource://gre/modules/Services.jsm",
  SessionStore: "resource:///modules/sessionstore/SessionStore.jsm",
  TabStateFlusher: "resource:///modules/sessionstore/TabStateFlusher.jsm",
});

XPCOMUtils.defineLazyGetter(this, "logConsole", function() {
  return console.createInstance({
    prefix: "SessionManager",
    maxLogLevel: Services.prefs.getBoolPref(
      "browser.places.perwindowsessions.log",
      false
    )
      ? "Debug"
      : "Warn",
  });
});

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "perWindowEnabled",
  "browser.places.perwindowsessions.enabled",
  false
);

/**
 * @typedef {object} Session
 * @property {string} guid
 *   The guid of the session.
 * @property {Date} lastSavedAt
 *   The time the session was last saved.
 */

/**
 * The session manager is wrapper around SessionStore and it is responsible
 * for handling sessions across the application. Each window is its own session.
 * Sessions may be saved, set aside and started at any time.
 */
const SessionManager = new (class SessionManager {
  /**
   * @type {string|null}
   *   The user's profile directory, cached to avoid repeated look-ups.
   */
  #profileDir = null;

  /**
   * Registers a new session for a window by allocating a UUID and registering
   * it with SessionStore.
   *
   * @param {DOMWindow} window
   *   The window in which to start the new session.
   */
  async register(window) {
    if (!perWindowEnabled) {
      return;
    }
    if (SessionStore.getCustomWindowValue(window, "SessionManagerGuid")) {
      // No need to register, we already have something for this window.
      return;
    }

    let guid = this.makeGuid();
    logConsole.debug("Starting new session", guid);
    // Write to the window first, whilst we're still in the synchronous part
    // to avoid re-entrancy issues.
    SessionStore.setCustomWindowValue(window, "SessionManagerGuid", guid);

    try {
      // Save the session in the database, so that we have the guid saved.
      // In the unlikely case that this fails due to the guid being non-unique,
      // then this function will fail early. On the next navigation/start point,
      // we'll try again with a different guid.
      await PlacesUtils.withConnectionWrapper(
        "SessionManager:register",
        async db => {
          await db.executeCached(
            `INSERT INTO moz_session_metadata (guid, last_saved_at, data)
             VALUES (:guid, :lastSavedAt, "{}")`,
            { lastSavedAt: Date.now(), guid }
          );
        }
      );
    } catch (ex) {
      logConsole.error("Could not write GUID for session", ex);
      // Since we could not write it, delete the GUID from the window for now.
      // Next time we attempt to register, then we'll try again.
      SessionStore.deleteCustomWindowValue(window, "SessionManagerGuid");
    }
  }

  /**
   * Sets aside the session in the selected window, saving it on disk
   * and in the database. If a new session is specified, then that session
   * will be restored into the window as well.
   *
   * @param {DOMWindow} window
   *   The window for the session to save.
   * @param {string} [restoreSessionGuid]
   *   The guid of the session to load into the window.
   */
  async setAside(window, restoreSessionGuid) {
    if (!perWindowEnabled) {
      return;
    }
    logConsole.debug("Saving session", window);

    // Start these at the same time, hopefully the save will be completed
    // before the data is written, if it is not, then we'll pause slightly
    // longer.

    // If this fails, the function will not complete and the existing session
    // will remain. This allows the user to take appropriate action.
    // TODO: MR2-867 - find a way of surfacing the failure to the user.
    await Promise.all([
      window.gBrowser.doPinebuildSessionHideAnimation(),
      (async () => {
        await TabStateFlusher.flushWindow(window);
        let windowData = SessionStore.getWindowState(window);
        await this.#saveSessionData(windowData.windows[0]);
      })(),
    ]);

    if (restoreSessionGuid) {
      await this.restoreInto(window, restoreSessionGuid);
      return;
    }

    SessionStore.deleteCustomWindowValue(window, "SessionManagerGuid");
    window.gGlobalHistory.reset();
    await window.gBrowser.doPinebuildSessionShowAnimation();
  }

  /**
   * Restores a saved session from disk and/or the database.
   *
   * @param {DOMWindow} window
   *   The window to restore into.
   * @param {string} guid
   *   The GUID of the session to restore.
   */
  async restoreInto(window, guid) {
    if (!perWindowEnabled) {
      throw new Error("SessionManager.restoreInto called when disabled.");
    }
    logConsole.debug("Restoring session", guid);
    // TODO: Temporarily this does the same as setAside with no new session.
    SessionStore.deleteCustomWindowValue(window, "SessionManagerGuid");
    window.gGlobalHistory.reset();
    await window.gBrowser.doPinebuildSessionShowAnimation();
  }

  /**
   * Queries for saved sessions in the database.
   *
   * Note: If both guid and url are specified, then the session will only be
   * returned if the url is contained within that session.
   *
   * @param {object} [options]
   * @param {guid} [options.guid]
   *    The specific guid to search for.
   * @param {string} [options.url]
   *    If provided, the query will be limited to sessions which contain the url.
   * @param {boolean} [options.includePages]
   *    Optionally include the pages associated with the session in the query
   *    results. This is a more expensive lookup, so is off by default.
   * @param {string} [options.limit]
   *    A limit to the number of query results to return.
   * @returns {Session[]}
   */
  async query({ guid, url, includePages = false, limit = 10 } = {}) {
    if (!perWindowEnabled) {
      return [];
    }

    let db = await PlacesUtils.promiseDBConnection();

    let clauses = [];
    let bindings = { limit };

    if (guid) {
      clauses.push("guid = :guid");
      bindings.guid = guid;
    }

    let whereStatement = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    let rows = await db.executeCached(
      `
      SELECT guid, last_saved_at, data FROM moz_session_metadata
      ${whereStatement}
      ORDER BY last_saved_at DESC
      LIMIT :limit
    `,
      bindings
    );

    let sessionData = rows.map(row => {
      return {
        guid: row.getResultByName("guid"),
        lastSavedAt: this.#dateOrNull(row.getResultByName("last_saved_at")),
        data: row.getResultByName("data"),
      };
    });

    if (includePages) {
      for (let session of sessionData) {
        // TODO: MR2-869 Potentially merge this with the query above to
        // improve performance.
        let pageRows = await db.executeCached(
          `SELECT h.url, p.position FROM moz_session_metadata s
           JOIN moz_session_to_places p ON p.session_id = s.id
           JOIN moz_places h ON h.id = p.place_id
           WHERE s.guid = :guid
           ORDER BY p.position ASC
          `,
          { guid: session.guid }
        );
        session.pages = pageRows.map(row => {
          return {
            url: row.getResultByName("url"),
            position: row.getResultByName("position"),
          };
        });
      }
    }

    return sessionData;
  }

  /**
   * Translates a date value from the database.
   *
   * @param {number} value
   *   The date in milliseconds from the epoch.
   * @returns {Date?}
   */
  #dateOrNull(value) {
    if (value) {
      return new Date(value);
    }
    return null;
  }

  /**
   * Wrapper function that is present for tests to make it possible to use
   * specific GUIDs.
   *
   * @returns {string}
   */
  makeGuid() {
    return PlacesUtils.history.makeGuid();
  }

  /**
   * Saves session data to the disk and to the database. Full session data
   * is stored on disk, whilst just the urls and positions in the river are
   * stored in the database.
   *
   * @param {object} data
   *   The data to save for the session, obtained from SessionStore.
   * @throws {DOMException|Error}
   *   This can throw a DOMException if the write to disk fails. It may also
   *   throw if there is an issue in the places database.
   */
  async #saveSessionData(data) {
    let guid = data.extData?.SessionManagerGuid;
    if (!guid) {
      logConsole.error("No session to save");
      return;
    }

    logConsole.debug("Saving session", guid);

    // First save the data to disk first as this is probably more likely to
    // fail than the write to DB, so we'll keep the data in sync in that case.
    let path = await this.#getSessionFilePath(guid);
    await IOUtils.writeJSON(path, data, {
      mode: "overwrite",
      compress: true,
      tmpPath: path + ".tmp",
    });

    // Now update the database.
    await PlacesUtils.withConnectionWrapper(
      "SessionManager:register",
      async db => {
        let pageMap = new Map();
        for (let tab of data.tabs) {
          for (let { ID, url } of tab.entries) {
            pageMap.set(ID, url);
          }
        }

        // We reverse the state then reverse it again after ordering the pages.
        // This has the side-effect of ensuring that we keep the most recent
        // duplicate of a page.
        let historyState = JSON.parse(
          data.extData.GlobalHistoryState
        ).reverse();

        let orderedPages = new Set();
        for (let entry of historyState) {
          let page = pageMap.get(entry.id);
          if (page) {
            orderedPages.add(page);
          }
        }

        let pages = [...orderedPages.values()];
        pages.reverse();
        pages = pages.map((url, position) => ({ url, position }));

        await db.executeTransaction(async () => {
          let rows = await db.executeCached(
            `UPDATE moz_session_metadata SET last_saved_at = :lastSavedAt
             WHERE guid = :guid
             RETURNING id`,
            { lastSavedAt: Date.now(), guid }
          );
          let sessionId = rows[0].getResultByName("id");

          // Some entries need removing, others modifying or adding. The easiest
          // way to do this is to remove the session first and then add only
          // what we need.
          await db.executeCached(
            `DELETE FROM moz_session_to_places WHERE session_id = :sessionId`,
            { sessionId }
          );

          for (let chunk of PlacesUtils.chunkArray(
            pages,
            // We're using 2 variables per row, and 1 extra variable across all rows.
            db.variableLimit / 2 - 1
          )) {
            let valuesFragment = Array.from(
              { length: chunk.length },
              (_, i) =>
                `(:sessionId, (SELECT id FROM moz_places WHERE url_hash = hash(:url${i}) AND url = :url${i}), :position${i})`
            );

            let values = { sessionId };
            for (let [i, value] of chunk.entries()) {
              values[`url${i}`] = value.url;
              values[`position${i}`] = value.position;
            }

            await db.executeCached(
              `
              INSERT OR IGNORE INTO moz_session_to_places (session_id, place_id, position)
              VALUES ${valuesFragment.join(",")}
              `,
              values
            );
          }
        });
      }
    );
  }

  async #getSessionFilePath(guid) {
    if (!this.#profileDir) {
      this.#profileDir = await PathUtils.getProfileDir();
    }
    return PathUtils.join(this.#profileDir, "sessions", `${guid}.jsonlz4`);
  }
})();
