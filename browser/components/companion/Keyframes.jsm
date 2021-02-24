/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["Keyframes"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

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

/*
XPCOMUtils.defineLazyGetter(this, "log", () => {
  let { ConsoleAPI } = ChromeUtils.import("resource://gre/modules/Console.jsm");
  return new ConsoleAPI({
    prefix: "Keyframes",
    maxLogLevel: "debug",
  });
});
*/

const ENGAGEMENT_TIMER = 1 * 1000; // 10 seconds

const SCHEMA_VERSION = 5;

/**
 * All SQL statements should be defined here.
 */
const SQL = {
  dropTables: "DROP TABLE keyframes;",

  createTables:
    "CREATE TABLE keyframes (" +
    "id INTEGER PRIMARY KEY, " +
    "timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
    "url TEXT NOT NULL, " +
    "type TEXT NOT NULL, " +
    "firstVisit INTEGER NOT NULL, " +
    "lastVisit INTEGER NOT NULL, " +
    "totalEngagement INTEGER NOT NULL " +
    ");",

  add:
    "INSERT INTO keyframes (url, type, firstVisit, lastVisit, totalEngagement) VALUES (:url, :type, :firstVisit, :lastVisit, :totalEngagement);",

  exists: "SELECT * FROM keyframes WHERE url = :url;",

  selectAll: "SELECT * FROM keyframes;",
};

function int(dateStr) {
  if (!dateStr) {
    return null;
  }

  return parseInt(dateStr);
}

var Keyframes = {
  _db: null,

  async addOrUpdate(url, type, firstVisit, lastVisit, totalEngagement) {
    if (!this._db) {
      await this.init();
    }
    let existingRows = await this._db.executeCached(SQL.exists, { url });
    if (existingRows.length) {
      for (let row of existingRows) {
        let id = row.getResultByName("id");
        let currentEngagement = row.getResultByName("totalEngagement");
        let newTotalEngagement =
          parseInt(currentEngagement) + parseInt(totalEngagement);
        let sql = `UPDATE keyframes SET lastVisit = '${lastVisit}', totalEngagement = '${newTotalEngagement}' WHERE id = '${id}'`;
        await this._db.executeCached(sql);
      }
    } else if (type != "automatic" || totalEngagement > ENGAGEMENT_TIMER) {
      await this._db.executeCached(SQL.add, {
        url,
        type,
        firstVisit,
        lastVisit,
        totalEngagement,
      });
    }
    Services.obs.notifyObservers(null, "keyframe-update");
  },

  async updateThumbnail(url, thumbnail) {
    if (!this._db) {
      await this.init();
    }
    let existingRows = await this._db.executeCached(SQL.exists, { url });
    if (existingRows.length) {
      for (let row of existingRows) {
        let id = row.getResultByName("id");
        let sql = `UPDATE keyframes SET thumbnail = '${thumbnail}' WHERE id = '${id}'`;
        await this._db.executeCached(sql);
      }
    }
    Services.obs.notifyObservers(null, "keyframe-update");
  },

  async query() {
    if (!this._db) {
      await this.init();
    }

    let records = await this._db.executeCached(SQL.selectAll, {});
    return records.map(record => {
      let lastVisit =
        int(record.getResultByName("lastVisit")) ??
        record.getResultByName("timestamp").replace(" ", "T") + "Z";

      return {
        id: record.getResultByName("id"),
        url: record.getResultByName("url"),
        lastVisit: new Date(lastVisit),
        totalEngagement: int(record.getResultByName("totalEngagement")) ?? 0,
      };
    });
  },

  async init() {
    let db = await Sqlite.openConnection({ path: DB_PATH });

    try {
      // Check to see if we need to perform any migrations.
      let dbVersion = parseInt(await db.getSchemaVersion());

      if (dbVersion < SCHEMA_VERSION) {
        // getSchemaVersion() returns a 0 int if the schema
        // version is undefined.
        if (dbVersion > 0) {
          // Blow away the existing database.
          await db.execute(SQL.dropTables);
        }
        await db.execute(SQL.createTables);
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
