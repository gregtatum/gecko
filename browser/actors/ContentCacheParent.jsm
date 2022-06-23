/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["ContentCacheParent"];

const lazy = {};
ChromeUtils.defineModuleGetter(
  lazy,
  "PlacesUtils",
  "resource://gre/modules/PlacesUtils.jsm"
);

/**
 * @typedef {Object} PageData
 * @property {string} content
 * @property {string} url
 * @property {string} locale
 */

/**
 * The ContentCacheParent adds pages to the contentcache.sql file through the
 * PlacesUtils database API.
 */
class ContentCacheParent extends JSWindowActorParent {
  /**
   * Lazily initialized console.
   * @type {null | Console}
   */
  #console = null;

  /**
   * Set the preference "browser.contentCache.logLevel" to "All" to see all console
   * messages. They are set to "Error" by default.
   *
   * @returns {Log}
   */
  get console() {
    if (!this.#console) {
      this.#console = console.createInstance({
        maxLogLevelPref: "browser.contentCache.logLevel",
        prefix: "ContentCacheParent",
      });
    }
    return this.#console;
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
        this.addPage(message.data);
        break;
    }
  }

  /**
   * Insert the content of a page into the sqlite FTS database.
   *
   * @param {PageData} pageData
   * @returns {Promise<void>}
   */
  async addPage(pageData) {
    this.console.log("add page", pageData);
    const { content, url } = pageData;
    await lazy.PlacesUtils.withConnectionWrapper(
      "ContentCacheParent.addPage",
      db => {
        return db.executeCached(
          /* sql */ `
          INSERT INTO moz_contentcache(content, url)
          VALUES (:content, :url)
        `,
          { content, url }
        );
      }
    );
  }
}
