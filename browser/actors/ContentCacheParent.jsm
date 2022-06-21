/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["ContentCacheParent"];

/**
 * @typedef {Object} PageData
 * @property {string} text
 * @property {string} url
 * @property {string} locale
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
      case "ContentCache:AddPage":
        this.addPage(message.data);
        break;
    }
  }

  /**
   * @param {PageData} pageData
   */
  addPage(pageData) {
    console.log(`TODO: ContentCacheParent.addPage`, pageData);
  }
}
