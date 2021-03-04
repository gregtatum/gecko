/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["EngagementChild"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  PrivateBrowsingUtils: "resource://gre/modules/PrivateBrowsingUtils.jsm",
  setTimeout: "resource://gre/modules/Timer.jsm",
  clearTimeout: "resource://gre/modules/Timer.jsm",
});

const CPM = 100; // Characters per minute

class EngagementChild extends JSWindowActorChild {
  actorCreated() {
    this.contentWindow.addEventListener("keyup", this);
  }

  /*
   * Events
   */
  didDestroy() {
    this.destroyed = true;
  }

  initWebProgressListener() {
    if (this.inited) {
      return;
    }
    this.inited = true;

    const webProgress = this.docShell
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsIWebProgress);

    const listener = {
      QueryInterface: ChromeUtils.generateQI([
        "nsIWebProgressListener",
        "nsISupportsWeakReference",
      ]),
    };

    listener.onLocationChange = (aWebProgress, aRequest, aLocation, aFlags) => {
      if (this.destroyed) {
        return;
      }

      if (PrivateBrowsingUtils.isContentWindowPrivate(this.contentWindow)) {
        return;
      }

      if (!aWebProgress.isTopLevel) {
        return;
      }
      let docInfo = {};
      docInfo.url = aLocation.specIgnoringRef;
      let context = this.manager.browsingContext;
      if (docInfo) {
        docInfo.isActive = context.isActive;
        docInfo.contextId = this.browsingContext.id;
        this.sendAsyncMessage("Engagement:Engage", docInfo);
      }
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
    return docInfo;
  }

  checkForDocument() {
    if (this._keysPerMinute >= CPM) {
      this._isDocument = true;
      this.sendAsyncMessage("Engagement:UpdateType", "document");
    }
  }
  /**
   * Handles events received from the actor child notifications.
   *
   * @param {object} event The event details.
   */
  async handleEvent(event) {
    if (PrivateBrowsingUtils.isContentWindowPrivate(this.contentWindow)) {
      return;
    }
    switch (event.type) {
      case "keyup":
        if (this._isDocument) {
          return;
        }
        if (event.code.startsWith("Key")) {
          if (!this._inputTimer) {
            let self = this;
            this._inputTimer = setTimeout(
              function() {
                self.checkForDocument()
              }, 60*1000);
            this._keysPerMinute = 0;
          }
          this._keysPerMinute++;
        }
        break;
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
        this.initWebProgressListener();
        if (
          !this.docShell.currentDocumentChannel ||
          !(this.docShell.currentDocumentChannel instanceof Ci.nsIHttpChannel)
        ) {
          return;
        }

        if (this.docShell.currentDocumentChannel.responseStatus == 404) {
          return;
        }

        let docInfo = await this.getDocumentInfo();
        let context = this.manager.browsingContext;
        if (docInfo) {
          docInfo.isActive = context.isActive;
          docInfo.contextId = this.browsingContext.id;
          this.sendAsyncMessage("Engagement:Engage", docInfo);
        }
        break;
      }
      case "pagehide": {
        if (
          !this.docShell.currentDocumentChannel ||
          !(this.docShell.currentDocumentChannel instanceof Ci.nsIHttpChannel)
        ) {
          return;
        }

        if (this.docShell.currentDocumentChannel.responseStatus == 404) {
          return;
        }

        let docInfo = await this.getDocumentInfo();
        if (docInfo) {
          docInfo.contextId = this.browsingContext.id;
          this.sendAsyncMessage("Engagement:Disengage", docInfo);
        }
        this._isDocument = false;
        if (this._inputTimer) {
          clearTimeout(this._inputTimer);
          this._inputTimer = 0;
        }
        this._keysPerMinute = 0;
        break;
      }
    }
  }
}
