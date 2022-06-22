/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["ContentCacheParent"];

const { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs"
});

/**
 * Set the preference "browser.contentCache.logLevel" to "All" to see all console
 * messages. They are set to "Error" by default.
 *
 * @returns {Log}
 */
XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.contentCache.logLevel",
    prefix: "ContentCacheParent",
  });
});


/**
 * @typedef {Object} PageData
 * @property {string} text
 * @property {string} url
 * @property {string} locale
 */

/**
 * The ContentCacheParent adds pages to the contentcache.sql file through the
 * PlacesUtils database API.
 */
class ContentCacheParent extends JSWindowActorParent {
  /**
   * @param {{
   *  name: "ContentCache",
   *  data: PageData
   * }} message
   */
  receiveMessage(message) {
    switch (message.name) {
      case "ContentCache:AddPage": {
        const { text, url } = message.data;
        lazy.PlacesUtils.withConnectionWrapper(
          "ContentCacheParent.addPage",
          db => DB.addPage(db, text, url)
        );
        break;
      }
    }
  }
}

/**
 * Static SQLite database functions.
 */
class DB {
  /**
   * @param {ConnectionData} db
   * @returns {Promise<null | string>}
   */
  static async getPlacesId(db, url) {
    const places = await db.executeCached(
      /* sql */ `
        SELECT id FROM moz_places
        WHERE url = :url
      `,
      { url }
    );
    if (places.length !== 1) {
      lazy.console.error("Unable to find a places entry for URL", url);
      return null;
    }
    return places[0].getResultByName("id");
  }

  /**
   * Note: call this in a transaction.
   *
   * @param {ConnectionData} db
   * @param {string} text
   * @param {number} placesId
   */
  static async insertOrUpdateText(db, text, placesId) {
    // Virtual tables do not support the "upsert" command that can update or insert
    // in one database call.
    if (await DB.doesPlaceExistInContentCache(db, placesId)) {
      await DB.updateText(db, text, placesId);
    } else {
      await DB.insertText(db, text, placesId);
    }
  }

  /**
   * @param {ConnectionData} db
   * @param {number} placesId
   * @returns {Promise<boolean>}
   */
  static async doesPlaceExistInContentCache(db, placesId) {
    const result = await db.executeCached(
      /* sql */ `
        SELECT EXISTS(SELECT 1 FROM moz_contentcache_text WHERE rowid=:placesId);
      `,
      { placesId }
    );
    return result[0].getResultByIndex(0) === 1;
  }

  /**
   * @param {ConnectionData} db
   * @param {string} text
   * @param {number} placesId
   */
  static async insertText(db, text, placesId) {
    await db.executeCached(
      /* sql */ `
        INSERT INTO moz_contentcache_text(rowid, text)
        VALUES (:placesId, :text)
      `,
      { placesId, text }
    );
  }

  /**
   * @param {ConnectionData} db
   * @param {string} text
   * @param {number} placesId
   */
  static async updateText(db, text, placesId) {
    await db.executeCached(
      /* sql */ `
        UPDATE moz_contentcache_text
        SET text = :text
        WHERE rowid = :placesId
      `,
      { placesId, text }
    );
  }

  /**
   * @param {ConnectionData} db
   * @param {string} text
   * @param {string} url
   */
  static async addPage(db, text, url) {
    await db.executeTransaction(async () => {
      // Look up the URL in the places database.
      const placesId = await DB.getPlacesId(db, url);
      lazy.console.log("Looked up places_id", placesId, url);
      if (placesId === null) {
        console.error("Unable to find a places entry for URL", url);
        return;
      }

      // Virtual tables do not support the "upsert" command that can update or insert
      // in one database call.
      if (await DB.doesPlaceExistInContentCache(db, placesId)) {
        lazy.console.log("Updating the text");
        await DB.updateText(db, text, placesId);
      } else {
        // This is the first time a URL has been visited for caching.
        lazy.console.log("Inserting the text");
        await DB.insertText(db, text, placesId);
      }

    });
  }
}
