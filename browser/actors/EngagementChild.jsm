/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["EngagementChild"];

class EngagementChild extends JSWindowActorChild {
  actorCreated() {
    this.initWebProgressListener();
  }

  initWebProgressListener() {
    const webProgress = this.manager.browsingContext.top.docShell
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIWebProgress);

    const listener = {
      QueryInterface: ChromeUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ]),
    };

    listener.onLocationChange = (aWebProgress, aRequest, aLocation, aFlags) => {
      this.sendAsyncMessage("Engagement:Log", "LOCATIONCHANGE");
    };

    webProgress.addProgressListener(
      listener,
      Ci.nsIWebProgress.NOTIFY_LOCATION
    );
  }

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
        //        this.sendAsyncMessage("Engagement:Log", "PAGESHOW");
        break;
      }
      case "load": {
        //        this.sendAsyncMessage("Engagement:Log", "LOAD");
        break;
      }
      case "DOMContentLoaded": {
        let docInfo = await this.getDocumentInfo();
        let context = this.manager.browsingContext;
        if (docInfo && context.isActive) {
          this.sendAsyncMessage("Engagement:Engage", docInfo);
        }
        break;
      }
      case "pagehide": {
        let docInfo = await this.getDocumentInfo();
        if (docInfo) {
          this.sendAsyncMessage("Engagement:Disengage", docInfo);
        }
        break;
      }
    }
  }
}
