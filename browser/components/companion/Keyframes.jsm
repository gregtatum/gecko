/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["Keyframes"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
//const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

ChromeUtils.defineModuleGetter(this, "OS", "resource://gre/modules/osfile.jsm");
ChromeUtils.defineModuleGetter(
  this,
  "Sqlite",
  "resource://gre/modules/Sqlite.jsm"
);

XPCOMUtils.defineLazyGetter(this, "DB_PATH", function() {
  return OS.Path.join(OS.Constants.Path.profileDir, "keyframes.sqlite");
});

XPCOMUtils.defineLazyModuleGetters(this, {
  AsyncShutdown: "resource://gre/modules/AsyncShutdown.jsm",
});

const SCHEMA_VERSION = 1;

/**
 * All SQL statements should be defined here.
 */
const SQL = {
  createTables:
    "CREATE TABLE keyframes (" +
    "id INTEGER PRIMARY KEY, " +
    "url TEXT NOT NULL" +
    ");",

  add: "INSERT INTO keyframes (url) VALUES (:url);",

  selectAll: "SELECT * FROM keyframes;",
};

var Keyframes = {
  _db: null,

  async add(url) {
    if (!this._db) {
      await this.init();
    }
    await this._db.executeCached(SQL.add, { url });
  },

  async query() {
    if (!this._db) {
      await this.init();
    }
    return this._db.executeCached(SQL.selectAll, {});
  },

  async init() {
    let db = await Sqlite.openConnection({ path: DB_PATH });

    try {
      // Check to see if we need to perform any migrations.
      let dbVersion = parseInt(await db.getSchemaVersion());

      // getSchemaVersion() returns a 0 int if the schema
      // version is undefined.
      if (dbVersion === 0) {
        await await db.execute(SQL.createTables);
      } else if (dbVersion < SCHEMA_VERSION) {
        // TODO
        // await upgradeDatabase(db, dbVersion, SCHEMA_VERSION);
      }

      await db.setSchemaVersion(SCHEMA_VERSION);
    } catch (e) {
      // Close the DB connection before passing the exception to the consumer.
      await db.close();
      throw e;
    }

    AsyncShutdown.profileBeforeChange.addBlocker(
      "TrackingDBService: Shutting down the content blocking database.",
      () => this._shutdown()
    );
    this._db = db;
  },

  async _shutdown() {
    await this._db.close();
  },
};
