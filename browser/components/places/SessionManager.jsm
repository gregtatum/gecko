/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["SessionManager"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  EventEmitter: "resource://gre/modules/EventEmitter.jsm",
  PlacesUtils: "resource://gre/modules/PlacesUtils.jsm",
  Services: "resource://gre/modules/Services.jsm",
  SessionStore: "resource:///modules/sessionstore/SessionStore.jsm",
  setTimeout: "resource://gre/modules/Timer.jsm",
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

const WINDOW_TRACKER_REMOVE_TOPIC = "sessionstore-closed-objects-changed";

/**
 * @typedef {object} SessionPageRecord
 * @property {string} url
 *   The url visited.
 * @property {number} position
 *   The position of the url in the active view manager.
 */

/**
 * @typedef {object} Session
 * @property {string} guid
 *   The guid of the session.
 * @property {Date} lastSavedAt
 *   The time the session was last saved.
 * @property {SessionPageRecord[]} pages
 *   A list of pages associated with the session.
 */

/**
 * The session manager is wrapper around SessionStore and it is responsible
 * for handling sessions across the application. Each window is its own session.
 * Sessions may be saved, set aside and started at any time.
 *
 * SessionManager is an event emitter that will emit events at various times:
 *
 * - sessions-updated
 *   This event is emitted when the session data has been updated, e.g. after
 *   a window is closed.
 *   It is not emitted when saving session data when replacing a session. Use
 *   the session-replaced event in that case.
 *
 * - session-change-start
 *   This event is emitted when a session change is started. The additional
 *   parameter is the window where the session change is happening.
 *
 * - session-set-aside
 *   This event is emitted when a session is set aside and the hide animations
 *   are complete, but before the show animation starts. The additional
 *   parameter is the window where the session change is happening.
 *
 * - session-replaced
 *   This event is emitted when a session has been replaced. The additional
 *   parameters are the window where the session was replaced and the guid
 *   of the new session. The guid may be null if there was no new session.
 */
const SessionManager = new (class SessionManager extends EventEmitter {
  init() {
    if (!perWindowEnabled) {
      return;
    }
    Services.obs.addObserver(this, WINDOW_TRACKER_REMOVE_TOPIC, true);

    PlacesUtils.history.shutdownClient.jsclient.addBlocker(
      "SessionManager: flushing sessions",
      () => {
        // Session store will have flushed the state of all windows in quit-application-granted so
        // we can grab it synchronously.
        let { windows } = SessionStore.getCurrentState();

        return Promise.all(
          windows.map(windowData => this.#saveSessionData(windowData))
        );
      }
    );
  }

  uninit() {
    if (!perWindowEnabled) {
      return;
    }
    Services.obs.removeObserver(this, WINDOW_TRACKER_REMOVE_TOPIC);
  }

  /**
   * @type {number}
   *   The last closed window Id received from Session Restore. Tracking this
   *   avoids re-saving closed windows multiple times.
   *   This starts at -1 to be below the initial value of
   *   SessionStoreInternal._nextClosedId.
   */
  #lastClosedWindowId = -1;

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
   * @param {nsIURI} url
   *   The url that was loaded to potentially trigger the new session.
   */
  async register(window, url) {
    if (!perWindowEnabled) {
      return;
    }
    if (SessionStore.getCustomWindowValue(window, "SessionManagerGuid")) {
      // No need to register, we already have something for this window.
      return;
    }
    if (!url || url.schemeIs("about") || url.schemeIs("chrome")) {
      return;
    }
    this.emit("session-view-added", window);

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
   * Saves the current session on disk and in the database. Then replaces it
   * with a new one, or restores a provided one.
   *
   * @param {DOMWindow} window
   *   The window for the session to save.
   * @param {string} [restoreSessionGuid]
   *   The guid of the session to load into the window.
   */
  async replaceSession(window, restoreSessionGuid) {
    if (!perWindowEnabled) {
      return;
    }

    // Kick off loading the new session data so that it is hopefully
    // ready as soon as we need it.
    let loadDataPromise;
    if (restoreSessionGuid) {
      loadDataPromise = this.#loadSessionData(restoreSessionGuid);
    }

    this.emit("session-change-start", window);

    // Start the animation and whilst that's running, start saving data.
    let {
      animationCompletePromise,
      timerCompletePromise,
    } = window.gBrowser.doPinebuildSessionHideAnimation();

    // If this fails, the function will not complete and the existing session
    // will remain. This allows the user to take appropriate action.
    // TODO: MR2-867 - find a way of surfacing the failure to the user.
    await Promise.all([
      // Wait for the animation to complete only, then we can start loading into
      // windows before the timer is complete.
      animationCompletePromise,
      (async () => {
        await TabStateFlusher.flushWindow(window);
        let windowData = SessionStore.getWindowState(window);
        await this.#saveSessionData(windowData.windows[0]);
      })(),
    ]);

    if (restoreSessionGuid) {
      // TODO: MR2-867 - if we are unable to load any data, we should find a way
      // of surfacing the failure to the user and recovering nicely.
      let data = await loadDataPromise;
      await this.#restoreInto(
        window,
        restoreSessionGuid,
        data,
        timerCompletePromise
      );
      return;
    }

    SessionStore.deleteCustomWindowValue(window, "SessionManagerGuid");
    this.emit("session-set-aside", window);
    window.gGlobalHistory.reset("about:flow-reset");
    // Let the time for the previous animation completely elapse before
    // we start the new one.
    await timerCompletePromise;
    await window.gBrowser.doPinebuildSessionShowAnimation();
    await window.gBrowser.showConfirmation("session-saved-confirmation");
    this.emit("session-replaced", window, restoreSessionGuid);
  }

  /**
   * Restores the last session.
   *
   * @param {DOMWindow} window
   *   The window for the session to save.
   */
  async restoreLastSession(window) {
    let results = await this.query({ limit: 1 });
    this.replaceSession(window, results?.[0].guid);
  }
  /**
   * Restores a saved session from disk and/or the database.
   *
   * @param {DOMWindow} window
   *   The window to restore into.
   * @param {string} guid
   *   The GUID of the session to restore.
   * @param {object} data
   *   The data to load for the session, recovered from disk.
   * @param {Promise} timerCompletePromise
   *   A promise that is resolved when the hide animation timer is complete.
   */
  async #restoreInto(window, guid, data, timerCompletePromise) {
    logConsole.debug("Loading session", guid, "from session store data");

    // Restoring the session also restores the SessionManagerGuid on the window.
    SessionStore.setWindowState(window, { windows: [data] }, true);

    // We really want to make sure that we've changed the session before showing
    // the animation. TabFirstContentfulPaint is a useful proxy, though we
    // won't wait a long time for it - if the network is slow to load, that
    // won't matter too much, we'll just have a blank tab displayed as the
    // animation starts.
    let contentfulPaintWaitTimeout = 1000;
    let promiseFirstPaint = Promise.race([
      new Promise(resolve => {
        window.gBrowser.addEventListener("TabFirstContentfulPaint", resolve, {
          once: true,
        });
      }),
      new Promise(resolve => setTimeout(resolve, contentfulPaintWaitTimeout)),
    ]);

    // Ensure we've fully completed the time for the previous animation,
    // and we've hit first paint for the session being loaded.
    await Promise.all([timerCompletePromise, promiseFirstPaint]);
    await window.gBrowser.doPinebuildSessionShowAnimation();
    this.emit("session-replaced", window, guid);
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
   * @param {boolean} [options.includeActive]
   *    Optionally include active sessions in the query results. Only applies
   *    if guid is not specified.
   * @param {boolean} [options.includePages]
   *    Optionally include the pages associated with the session in the query
   *    results. This is a more expensive lookup, so is off by default.
   * @param {string} [options.limit]
   *    A limit to the number of query results to return.
   * @returns {Session[]}
   */
  async query({
    guid,
    url,
    includeActive = false,
    includePages = false,
    limit = 10,
  } = {}) {
    if (!perWindowEnabled) {
      return [];
    }

    let db = await PlacesUtils.promiseDBConnection();

    let clauses = [];

    let activeSessions = [];
    // Only work out active sessions if not looking for a specific guid.
    if (!includeActive && !guid) {
      activeSessions = this.#getActiveSessions();
    }

    // The limit is increased by the number of active sessions, in case we
    // need to remove those from the results.
    let bindings = { limit: limit + activeSessions.length };

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
    let sessionData = rows
      .map(row => {
        return {
          guid: row.getResultByName("guid"),
          lastSavedAt: this.#dateOrNull(row.getResultByName("last_saved_at")),
          data: row.getResultByName("data"),
        };
      })
      .filter(row => !activeSessions.includes(row.guid));

    // Ensure we still only return the limit, e.g. if active sessions were not
    // in the result.
    if (sessionData.length > limit) {
      sessionData.length = limit;
    }

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

  /*
   * Handles notifications from the observer service.
   *
   * @param {nsISupports} subject
   * @param {string} topic
   * @param {string} data
   */
  observe(subject, topic, data) {
    switch (topic) {
      case WINDOW_TRACKER_REMOVE_TOPIC:
        this.#saveClosedWindowData();
        break;
    }
  }

  /**
   * Handles saving of sessions in closed windows.
   */
  async #saveClosedWindowData() {
    let data = SessionStore.getClosedWindowData(false);
    let highestWindowId = -1;
    for (let windowData of data) {
      if (windowData.closedId > this.#lastClosedWindowId) {
        await this.#saveSessionData(windowData).catch(logConsole.error);
        // Keep track of the highest window Id we saved, so that we can
        // avoid saving the same windows multiple times.
        highestWindowId = Math.max(windowData.closedId, highestWindowId);
      }
    }
    this.#lastClosedWindowId = highestWindowId;
    this.emit("sessions-updated");
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
   * Loads session data from the disk. If the data is not found locally,
   * then it will be loaded from the places store.
   *
   * @param {string} guid
   *   The guid of the session to load data for.
   * @returns {object} data
   *   The session data.
   */
  async #loadSessionData(guid) {
    let path = await this.#getSessionFilePath(guid);
    let data;
    try {
      data = await IOUtils.readJSON(path, { decompress: true });
    } catch (ex) {
      if (ex.name != "NotFoundError") {
        logConsole.error("Failed to read session store file for", guid, ex);
      }
    }
    if (!data) {
      logConsole.debug(
        "Falling back to loading session",
        guid,
        "from saved places data"
      );

      let sessionData = await this.query({ guid, includePages: true });

      // Formulate our own simulated session store data structure.
      data = {
        extData: {
          SessionManagerGuid: guid,
        },
        selected: sessionData[0].pages.length,
      };

      let historyState = [];
      // There is no record of what was loaded in particular tabs, simply
      // load everything in separate tabs.
      data.tabs = sessionData[0].pages.map((p, i) => {
        historyState.push({ id: i, cachedEntry: null });
        return {
          entries: [
            {
              ID: i,
              url: p.url,
            },
          ],
        };
      });

      data.extData.GlobalHistoryState = JSON.stringify(historyState);
    }
    return data;
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
      logConsole.debug("No session to save");
      return;
    }

    logConsole.debug("Saving session", guid);

    // Here we filter out internal pages from the data. We also build the
    // page map that we need for working out the order of the pages.
    // If that filtering ends up in an empty section, we'll filter that out
    // too.
    let pageMap = new Map();
    data.tabs = data.tabs.filter(tab => {
      tab.entries = tab.entries.filter(({ url, ID }) => {
        if (url.startsWith("about:") || url.startsWith("chrome:")) {
          return false;
        }
        pageMap.set(ID, url);
        return true;
      });
      return tab.entries.length;
    });

    if (!data.tabs.length) {
      logConsole.error(
        "Unexpected empty session after filtering internal pages"
      );
      return;
    }

    // First save the data to disk first as this is probably more likely to
    // fail than the write to DB, so we'll keep the data in sync in that case.
    let path = await this.#getSessionFilePath(guid);
    await IOUtils.writeJSON(path, data, {
      mode: "overwrite",
      compress: true,
      tmpPath: path + ".tmp",
    });

    // Now work out what we need for updating the database.

    // We reverse the state then reverse it again after ordering the pages.
    // This has the side-effect of ensuring that we keep the most recent
    // duplicate of a page.
    let historyState = JSON.parse(data.extData.GlobalHistoryState).reverse();

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

    await PlacesUtils.withConnectionWrapper(
      "SessionManager:register",
      async db => {
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

  #getActiveSessions() {
    let activeSessions = [];
    let windowSessionGuid;
    for (let win of BrowserWindowTracker.orderedWindows) {
      try {
        windowSessionGuid = SessionStore.getCustomWindowValue(
          win,
          "SessionManagerGuid"
        );
      } catch (ex) {
        // In some cases SessionStore might not be tracking a window, that is
        // fine, just continue.
      }
      if (windowSessionGuid) {
        activeSessions.push(windowSessionGuid);
      }
    }
    return activeSessions;
  }

  QueryInterface = ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]);
})();
