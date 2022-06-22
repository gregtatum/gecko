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

ChromeUtils.defineModuleGetter(
  lazy,
  "AsyncShutdown",
  "resource://gre/modules/AsyncShutdown.jsm"
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

    // Closing can result in data-loss if the program is shut down while the connection
    // is still being closed or used. Add a shutdown guard to prevent this.
    lazy.AsyncShutdown.profileBeforeChange.addBlocker(
      "ContentCacheParent: closing db connection",
      () => this.close()
    );
  }

  #pendingStatements = new Set();

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
      // This call is trying to get a database connection while a previous connection
      // is still closing. Wait for the previous connection to close.
      await this.#closing;
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
   * Once all actors have been closed, it closes the connection to the database. The
   * connection is also closed during browser shutdown. This process can be slightly
   * complex as pending transactions need to complete, and it needs to happen before
   * browser shutdown.
   *
   * See the shutdown guard in the constructor.
   */
  close() {
    const dbPromise = this.#db;
    if (!dbPromise) {
      // Only close if a connection has been made.
      return Promise.resolve();
    }

    if (this.#closing) {
      // Already shutting down.
      return this.#closing;
    }

    // Two things need to happen synchronously in this function. The db connection
    // needs to be removed, and a closing promise need to be made. These are then used
    // to coordinate re-opening a database connection. A new connection can't be opened
    // until a previous closing is done.
    this.#db = null;

    this.#closing = (async () => {
      this.console.log("initiating db close process");
      const db = await dbPromise;

      // The .close() method will cut off any pending transactions, wait for them.
      // The pending statement promises are infallible.
      if (this.#pendingStatements.size > 0) {
        this.console.log("waiting for pending statements");

        await Promise.all(this.#pendingStatements);

        if (this.#pendingStatements.size !== 0) {
          throw new Error(
            "Logic error, pending statements are left while closing the db connection."
          );
        }
      }

      // Perform the actual DB close.
      this.console.log("closing db");
      await db.close();
      this.console.log("db closed");

      // Clear out the closing promise, as this will allow new connections to be
      // without waiting for the close.
      this.#closing = null;
    })().catch(error => {
      this.console.error("Error closing database:", error);
    });

    return this.#closing;
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
    const statement = db.executeCached(
      /* sql */ `
        INSERT INTO content_cache(content, url)
        VALUES (:content, :url)
      `,
      { content, url }
    );

    this.#pendingStatements.add(statement);

    await statement.catch(err => {
      this.console.error("Unable to add a page", err);
    });

    this.#pendingStatements.delete(statement);

    await statement;
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
