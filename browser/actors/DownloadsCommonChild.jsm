/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
/* eslint-env mozilla/browser-window */

"use strict";

var EXPORTED_SYMBOLS = ["DownloadsCommonChild"];

class DownloadsCommonChild extends JSWindowActorChild {
  receiveMessage(aMessage) {
    switch (aMessage.name) {
      case "Download:onDownloadBatchStarting": {
        this.sendToPage({ type: "onDownloadBatchStarting" });
        break;
      }
      case "Download:onDownloadBatchEnded": {
        this.sendToPage({ type: "onDownloadBatchEnded" });
        break;
      }
      case "Download:onDownloadAdded": {
        this.sendToPage({ type: "onDownloadAdded", download: aMessage.data });
        break;
      }
      case "Download:onDownloadChanged": {
        this.sendToPage({ type: "onDownloadChanged", download: aMessage.data });
        break;
      }
      case "Download:onDownloadRemoved": {
        this.sendToPage({ type: "onDownloadRemoved", download: aMessage.data });
        break;
      }
    }
  }

  handleEvent(event) {
    switch (event.type) {
      case "DownloadGetData": {
        this.sendAsyncMessage("Download:GetData", { history: true });
        break;
      }
      case "DownloadLaunchDownload": {
        this.sendAsyncMessage("Download:LaunchDownload", {
          download: event.detail.download,
        });
        break;
      }
      case "DownloadDoCommand": {
        this.sendAsyncMessage("Download:DoCommand", {
          command: event.detail.command,
          download: event.detail.download,
        });
        break;
      }
    }
  }

  sendToPage(action) {
    const win = this.document.defaultView;
    const event = new win.CustomEvent("DownloadToContent", {
      detail: Cu.cloneInto(action, win),
    });
    win.dispatchEvent(event);
  }
}
