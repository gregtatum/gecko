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

const SCHEMA_VERSION = 9;

/**
 * All SQL statements should be defined here.
 */
const SQL = {
  dropTables: "DROP TABLE IF EXISTS keyframes;",

  createTables:
    "CREATE TABLE keyframes (" +
    "id INTEGER PRIMARY KEY, " +
    "timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
    "url TEXT NOT NULL," +
    "type TEXT NOT NULL, " +
    "firstVisit INTEGER NOT NULL, " +
    "lastVisit INTEGER NOT NULL, " +
    "totalEngagement INTEGER NOT NULL, " +
    "typingTime INTEGER NOT NULL DEFAULT 0, " +
    "keypresses INTEGER NOT NULL DEFAULT 0, " +
    "category TEXT NOT NULL DEFAULT \"\" " +  // "shopping", "article", or "" for unknown
    ");",

  add:
    "INSERT INTO keyframes (url, type, firstVisit, lastVisit, totalEngagement) VALUES (:url, :type, :firstVisit, :lastVisit, :totalEngagement);",

  getId:
    "SELECT id FROM keyframes WHERE url = (:url) AND type = (:type) AND firstVisit = (:firstVisit);",

  exists: "SELECT * FROM keyframes WHERE id = :id;",

  select:
    "SELECT id, type, url, max(lastVisit) AS lastVisit, " +
    "sum(totalEngagement) as totalEngagement, " +
    "sum(typingTime) as typingTime, " +
    "sum(keypresses) as keypresses, " +
    "category FROM " +
    "keyframes WHERE {WHERE} GROUP BY url ORDER BY {ORDER};",
};

function int(dateStr) {
  if (typeof dateStr != "number") {
    return null;
  }

  return parseInt(dateStr);
}

var Keyframes = {
  _db: null,
  _initPromise: null,

  async add(url, type, firstVisit, totalEngagement) {
    if (!this._db) {
      await this.init();
    }
    await this._db.executeCached(SQL.add, {
      url,
      type,
      firstVisit,
      lastVisit: Date.now(),
      totalEngagement,
    });
    let rows = await this._db.executeCached(SQL.getId, {
      url,
      type,
      firstVisit,
    });
    Services.obs.notifyObservers(null, "keyframe-update");
    return rows.length ? rows[0].getResultByName("id") : null;
  },

  async updateKeypresses(id, typingTime, keypresses) {
    if (!this._db) {
      await this.init();
    }
    console.log("Adding keypresses", typingTime, keypresses);
    let sql = `UPDATE keyframes SET lastVisit = :lastVisit, typingTime = typingTime + :typingTime, keypresses = keypresses + :keypresses WHERE id = :id`;
    await this._db.executeCached(sql, {
      id,
      typingTime,
      keypresses,
      lastVisit: Date.now(),
    });
    Services.obs.notifyObservers(null, "keyframe-update");
  },

  async updateEngagement(id, totalEngagement) {
    if (!this._db) {
      await this.init();
    }
    let sql = `UPDATE keyframes SET lastVisit = :lastVisit, totalEngagement = :totalEngagement WHERE id = :id`;
    await this._db.executeCached(sql, {
      id,
      totalEngagement,
      lastVisit: Date.now(),
    });
    Services.obs.notifyObservers(null, "keyframe-update");
  },

  async updateType(id, newType) {
    if (!this._db) {
      await this.init();
    }
    let sql = `UPDATE keyframes SET type = :newType WHERE id = :id`;
    await this._db.executeCached(sql, {
      id,
      newType,
    });
    Services.obs.notifyObservers(null, "keyframe-update");
  },

  async updateCategory(id, newCategory) {
    if (!this._db) {
      await this.init();
    }
    let sql = `UPDATE keyframes SET category = :newCategory WHERE id = :id`;
    await this._db.executeCached(sql, {
      id,
      newCategory,
    });
    Services.obs.notifyObservers(null, "keyframe-update");
  },

  async query(minTime, maxTime = null, type = null, where = null, orderBy = "url ASC") {
    if (!this._db) {
      await this.init();
    }

    let params = {
      minTime,
    };


    let _where = "lastVisit > :minTime";
    if (maxTime) {
      _where += " AND firstVisit < :maxTime";
      params.maxTime = maxTime;
    }
    if (type) {
      _where += " AND type = :type";
      params.type = type;
    }
    if (where) {
      _where += " AND " + where;
    }
    let sql = SQL.select
      .replace("{WHERE}", _where)
      .replace("{ORDER}", orderBy);

    let records = await this._db.executeCached(sql, params);

    return records.map(record => {
      let lastVisit =
        int(record.getResultByName("lastVisit")) ??
        record.getResultByName("timestamp").replace(" ", "T") + "Z";

      return {
        id: record.getResultByName("id"),
        type: record.getResultByName("type"),
        url: record.getResultByName("url"),
        lastVisit: new Date(lastVisit),
        totalEngagement: int(record.getResultByName("totalEngagement")) ?? 0,
        typingTime: int(record.getResultByName("typingTime")),
        keypresses: int(record.getResultByName("keypresses")),
        category: record.getResultByName("category"),
      };
    });
  },

  // Generates the list of "Currently Working On" keyframes/documents
  async getTopKeypresses(minTime, maxTime = null, type = null) {
    return await this.query(minTime, maxTime, type, "keypresses > 100", "keypresses DESC");
  },

  async _init() {
    let db = await Sqlite.openConnection({ path: DB_PATH });

    try {
      // Check to see if we need to perform any migrations.
      let dbVersion = parseInt(await db.getSchemaVersion());

      if (dbVersion != SCHEMA_VERSION) {
        // Blow away any existing table.
        await db.execute(SQL.dropTables);
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

  init() {
    if (!this._initPromise) {
      this._initPromise = this._init();
    }

    return this._initPromise;
  },

  async _shutdown() {
    await this._db.close();
  },
};
