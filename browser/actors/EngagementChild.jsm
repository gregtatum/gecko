/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["EngagementChild"];

class EngagementChild extends JSWindowActorChild {
  async getDocumentInfo() {
    let doc = this.document;
    if (
      doc.documentURIObject.scheme != "http" &&
      doc.documentURIObject.scheme != "https"
    ) {
      return null;
    }
    let docInfo = {};
    docInfo.url = doc.documentURIObject.specIgnoringRef;
    /*
    // Just using doc URL for now because we would have to fix engagement to get the canonical
    // URLs too

    let link = doc.querySelector("link[rel='canonical']")?.getAttribute("href");
    if (link) {
      docInfo.url = link;
    }
    let ogURL = doc.querySelector("meta[property='og:url']")?.getAttribute('content');
    if (ogURL) {
      docInfo.url = ogURL;
    }
*/
    let ogImage = doc
      .querySelector("meta[property='og:image']")
      ?.getAttribute("content");
    if (ogImage) {
      docInfo.thumbnail = ogImage;
    }
    return docInfo;
  }

  /**
   * Handles events received from the actor child notifications.
   *
   * @param {object} event The event details.
   */
  async handleEvent(event) {
    switch (event.type) {
      case "pageshow": {
        // BFCACHE - not sure what to do here yet.
        //        check();
        break;
      }
      case "DOMContentLoaded": {
        let docInfo = await this.getDocumentInfo();
        if (docInfo) {
          this.sendAsyncMessage("Engagement:StartTimer", docInfo);
        }
        break;
      }
    }
  }
}
