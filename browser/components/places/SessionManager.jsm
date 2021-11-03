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
const SESSION_WRITE_COMPLETE_TOPIC = "sessionstore-state-write-complete";

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
 * - session-set-aside
 *   This event is emitted when a session is set aside and the hide animations
 *   are complete, but before the show animation starts. The additional
 *   parameter is the window where the session change is happening.
 *
 * - session-replaced
 *   This event is emitted when a session has been replaced. The additional
 *   parameters are the window where the session was replaced and the guid
 *   of the new session. The guid may be null if there was no new session.
 *
 * - session-save-error
 *   This event is emitted when there was an error while trying to save the
 *   session, and as a consequence the session was not stored on disk. The
 *   additional parameter is an Error representing the failure. The Error object
 *   is decorated with one additional `type` property, describing the reason of
 *   the failure:
 *    - "NoSpaceLeftOnDevice"
 *        not enough space left on disk, or the filesystem is corrupt and
 *        reports no space.
 *    - "InvalidSessionFilePath"
 *        Session file path may be too long, or it may point to an invalid node.
 *    - "SessionFileAccessDenied"
 *        The session file is not writable, or has wrong permissions.
 *    - "DatabaseAccessDenied"
 *        The database file cannot be accessed, either it has wrong permissions,
 *        is read-only, or file system is corrupt.
 *    - "OutOfMemory"
 *        The system is out of memory.
 *    - "Abort"
 *        The operation was unexpectedly interrupted.
 *    - "CorruptDatabase"
 *        Generic database corruption.
 */
const SessionManager = new (class SessionManager extends EventEmitter {
  init() {
    if (!perWindowEnabled) {
      return;
    }
    Services.obs.addObserver(this, WINDOW_TRACKER_REMOVE_TOPIC, true);
    Services.obs.addObserver(this, SESSION_WRITE_COMPLETE_TOPIC, true);

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
    Services.obs.removeObserver(this, SESSION_WRITE_COMPLETE_TOPIC);
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
   * @type {Set}
   *   Any pending saves to happen after the next session store save cycle.
   */
  #pendingSaves = new Set();

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
    if (this.#hasActiveSession(window)) {
      // No need to register, we already have something for this window.
      return;
    }
    if (!url || url.schemeIs("about") || url.schemeIs("chrome")) {
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
      this.emit("session-save-error", annotateDatabaseError(ex));
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

    let abort = await window.gBrowser.runBeforeUnloadForTabs(
      window.gBrowser.visibleTabs
    );
    if (abort) {
      return;
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
    window.gGlobalHistory.reset({
      url: "about:flow-reset",
      // runBeforeUnloadForTabs has been called above.
      skipPermitUnload: true,
    });
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
   * Saves a window's session on the next SessionStore update, this is normally
   * triggered by a blur of the window.
   *
   * @param {DOMWindow} window
   *   The window for the session to save.
   */
  async queueSessionSave(window) {
    if (this.#hasActiveSession(window)) {
      this.#pendingSaves.add(window);
    }
  }

  /**
   * Clears a window from being saved, e.g. for when a window is unloaded.
   *
   * @param {DOMWindow} window
   *   The window for which to clear any saves.
   */
  async clearSessionSave(window) {
    this.#pendingSaves.delete(window);
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
      case SESSION_WRITE_COMPLETE_TOPIC:
        this.#savePendingWindowData();
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
   * Saves session data for any windows that are pending, e.g. have recently
   * been deactivated.
   *
   * This does not force update of the session store window/tab data. Therefore
   * this data may be slightly out of date (< 30 seconds), which is currently
   * deemed acceptable.
   */
  async #savePendingWindowData() {
    if (!this.#pendingSaves.size) {
      return;
    }

    for (let window of this.#pendingSaves) {
      let windowData = SessionStore.getWindowState(window);
      await this.#saveSessionData(windowData.windows[0]);
    }
    this.#pendingSaves.clear();
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
   * Write compressed data to a path.
   * This is a separate public method for testing purposes.
   * @param {string} path Path to the compressed JSON file to write
   * @param {object} data The data to write
   */
  async write(path, data) {
    await IOUtils.writeJSON(path, data, {
      mode: "overwrite",
      compress: true,
      tmpPath: path + ".tmp",
    });
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

    this.#removeUnwantedSessionData(data);

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
    try {
      await this.write(path, data);
    } catch (ex) {
      this.emit("session-save-error", annotateIOError(ex, path));
      throw ex;
    }

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

    try {
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
    } catch (ex) {
      this.emit("session-save-error", annotateDatabaseError(ex));
      throw ex;
    }
  }

  /**
   * Removes from a SessionStore session any data that should not be restored.
   * For example, we don't want to save complete window state, as some of it
   * should not apply to per-window sessions.
   *
   * @param {object} data
   *   The session data to be modified. This is changed in-place.
   */
  #removeUnwantedSessionData(data) {
    // We don't save most data related to the window.
    for (let item of [
      "height",
      "screenX",
      "screenY",
      "sizemode",
      "sizemodeBeforeMinimized",
      "width",
      "workspaceID",
      "zIndex",
    ]) {
      delete data[item];
    }
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

  /**
   * Determine if a window has an active session or not.
   *
   * @param {DOMWindow} window
   *   The window to check.
   * @returns {boolean}
   *   True if there is an active session.
   */
  #hasActiveSession(window) {
    return !!SessionStore.getCustomWindowValue(window, "SessionManagerGuid");
  }

  QueryInterface = ChromeUtils.generateQI([
    "nsIObserver",
    "nsISupportsWeakReference",
  ]);
})();

/**
 * Annotates a database generated exception with a more specific error type.
 * @param {Exception} ex The exception to annotate.
 * @returns {Exception} An exception annotated with a `type` property, having
 *   one of the following values:
 *     - "DatabaseAccessDenied": The database file cannot be accessed.
 *     - "NoSpaceLeftOnDevice": Not enough space left.
 *     - "OutOfMemory": Out of memory.
 *     - "Abort": Operation was interrupted.
 *     - "CorruptDatabase": Generic database corruption.
 */
function annotateDatabaseError(ex) {
  switch (ex.result) {
    case Cr.NS_ERROR_FILE_ACCESS_DENIED:
    case Cr.NS_ERROR_FILE_IS_LOCKED:
    case Cr.NS_ERROR_FILE_READ_ONLY:
    case Cr.NS_ERROR_STORAGE_IOERR:
      ex.type = "DatabaseAccessDenied";
      break;
    case Cr.NS_ERROR_ABORT:
    case Cr.NS_ERROR_STORAGE_BUSY:
      ex.type = "Abort";
      break;
    case Cr.NS_ERROR_FILE_NO_DEVICE_SPACE:
      ex.type = "NoSpaceLeftOnDevice";
      break;
    case Cr.NS_ERROR_OUT_OF_MEMORY:
      ex.type = "OutOfMemory";
      break;
    default:
      ex.type = "CorruptDatabase";
      break;
  }
  return ex;
}

/**
 * Annotates a IO generated exception with a more specific error type.
 * @param {Exception} ex The exception to annotate.
 * @param {string} path The path to the file.
 * @returns {Exception} An exception annotated with a `type` property, having
 *   one of the following values:
 *     - "NoSpaceLeftOnDevice": Not enough space left, or corrupt filesystem
 *                              showing no space.
 *     - "InvalidSessionFilePath": Session file path may be too long,
 *                                 unrecognized, or wrong type.
 *     - "SessionFileAccessDenied": The session file is not writable.
 *   Additionally a `path` property is set to the passed-in path argument.
 */
function annotateIOError(ex, path) {
  switch (ex.name) {
    case "OperationError":
    case "InvalidAccessError":
      ex.type = "InvalidSessionFilePath";
      break;
    case "NotReadableError":
      if (ex.message.includes("Target device is full")) {
        ex.type = "NoSpaceLeftOnDevice";
        break;
      }
    // Fall-through.
    default:
      ex.type = "SessionFileAccessDenied";
      break;
  }
  ex.path = path;
  return ex;
}
