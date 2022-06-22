/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["ContentCacheParent"];

const lazy = {};
ChromeUtils.defineModuleGetter(
  lazy,
  "Sqlite",
  "resource://gre/modules/Sqlite.jsm"
);

const SCHEMA_VERSION = 1;

/**
 * @typedef {Object} PageData
 * @property {string} content
 * @property {string} url
 * @property {string} locale
 */

/**
 * This class manages the connection to the content cache database, stored at
 * "<ProfileDir>/contentcache.sql". This database stores a cache of all content
 * that has been seen by the user.
 */
class ContentCacheDB {
  constructor() {
    this.console.log("constructing");
  }

  /**
   * Lazily initialized console.
   * @type {null | Console}
   */
  #console = null;

  /**
   * Set the preference "browser.contentCache.logLevel" to "all" to see all console
   * messages. They are off by default.
   *
   * @returns {Log}
   */
  get console() {
    if (!this.#console) {
      let { ConsoleAPI } = ChromeUtils.import(
        "resource://gre/modules/Console.jsm"
      );
      const consoleInstance = new ConsoleAPI({
        maxLogLevelPref: "browser.contentCache.logLevel",
        prefix: "ContentCacheParent",
      });
      this.#console = consoleInstance;
    }
    return this.#console;
  }

  /**
   * Lazily initialized sqlite database connection.
   * @type {OpennedConnect | null} */
  #db = null;

  /**
   * @returns {Promise<OpennedConnect>}
   */
  async getDB() {
    if (this.#db) {
      return this.#db;
    }

    if (this.#closing) {
      // Still waiting for the previous close event.
      await this.#closing;
      this.#closing = null;
    }

    this.#db = this.#openConnection();
    return this.#db;
  }

  /**
   * Opens a connection to the database and ensures it is upgraded to the correct
   * schema.
   *
   * @returns {Promise<OpennedConnect>}
   */
  async #openConnection() {
    this.console.log("open connection");
    const db = await lazy.Sqlite.openConnection({
      // The path is relative to the profile directory.
      path: "contentcache.sqlite",
    });

    await this.#ensureDatabaseIsUpgraded(db);

    return db;
  }

  /** @type {null | Promise<void>} */
  #closing = null;

  /**
   * Once all actors have been closed, it closes the connection to the database.
   */
  close() {
    if (this.#db) {
      this.console.log("closing db connection");
      // TODO - The .close() documentation states that active statements will be cut off.
      // Do we need to count pending queries, or maybe create a queue of some kind?
      this.#closing = this.#db.then(db => db.close());
      this.#db = null;
    }
  }

  /**
   * Insert the content of a page into the sqlite FTS database.
   *
   * @param {PageData} pageData
   * @returns {Promise<void>}
   */
  async addPage(pageData) {
    const db = await this.getDB();
    this.console.log("add page", pageData);
    const { content, url } = pageData;
    await db.executeCached(
      /* sql */ `
        INSERT INTO content_cache(content, url)
        VALUES (:content, :url)
      `,
      { content, url }
    );
  }

  #upgradeCheckPerformed = false;

  /**
   * Creates the schema and upgrades the database as needed.
   *
   * @param {OpenedConnection}
   * @returns {Promise<void>}
   */
  async #ensureDatabaseIsUpgraded(connection) {
    if (this.#upgradeCheckPerformed) {
      // Only perform this check on the first open.
      return;
    }
    this.#upgradeCheckPerformed = true;

    // Upgrade the schema to the current version.
    await connection.executeTransaction(async () => {
      const schema = await connection.getSchemaVersion();

      switch (schema) {
        case 0: {
          // The database hasn't been initialized yet. Create the tables.
          await connection.execute(/* sql */ `
            CREATE VIRTUAL TABLE content_cache
            USING FTS5(content, url, tokenize="unicode61")
          `);
          connection.setSchemaVersion(SCHEMA_VERSION);
          this.console.log(`create schema version ${SCHEMA_VERSION}`);
          break;
        }
        case 1:
          this.console.log(`schema version ${SCHEMA_VERSION} is up to date`);
          break;
        default:
          throw new Error(
            "Unknown schema version for the content cache database. " + schema
          );
      }
    });
  }
}

/**
 * The content cache parent passes messages to the ContentCacheDB, which only lives
 * in the parent process. There is a single instance of it at a time.
 */
class ContentCacheParent extends JSWindowActorParent {
  static contentCacheDB = new ContentCacheDB();
  static actorCount = 0;

  constructor() {
    super();
    ContentCacheParent.actorCount++;
  }

  didDestroy() {
    ContentCacheParent.actorCount--;
    if (ContentCacheParent.actorCount === 0) {
      ContentCacheParent.contentCacheDB.close();
    }
  }

  /**
   * @param {{
   *  name: "ContentCache",
   *  data: PageData
   * }} message
   */
  receiveMessage(message) {
    switch (message.name) {
      case "ContentCache:AddPage":
        ContentCacheParent.contentCacheDB.addPage(message.data);
        break;
    }
  }
}
