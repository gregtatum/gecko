/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["SessionManager"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  Services: "resource://gre/modules/Services.jsm",
});

XPCOMUtils.defineLazyGetter(this, "logConsole", function() {
  return console.createInstance({
    prefix: "SessionManager",
    maxLogLevel: Services.prefs.getBoolPref(
      "browser.places.interactions.log",
      false
    )
      ? "Debug"
      : "Warn",
  });
});

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "perWindowEnabled",
  "browser.sessionstore.perwindow",
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
    logConsole.debug("Starting new session");
  }

  /**
   * Sets aside the session in the selected window, saving it on disk
   * and in the database. If a new session is specified, then that session
   * will be restored into the window as well.
   *
   * @param {DOMWindow} window
   *   The window for the session to save.
   * @param {string} [newSessionGuid]
   *   The guid of the session to load into the window.
   */
  async setAside(window, newSessionGuid) {
    if (!perWindowEnabled) {
      return;
    }
    logConsole.debug("Saving session", window);
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
  }

  /**
   * Queries for saved sessions in the database.
   *
   * @param {object} options
   * @param {string} [options.url]
   *    If provided, the query will be limited to sessions which contain the url.
   * @param {string} [options.limit]
   *    A limit to the number of query results to return.
   * @returns {Session[]}
   */
  async query({ url, limit = 10 }) {
    if (!perWindowEnabled) {
      return [];
    }
    return [];
  }
})();
