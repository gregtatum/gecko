/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["DownloadsCommonParent"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const { Integration } = ChromeUtils.import(
  "resource://gre/modules/Integration.jsm"
);

/* global DownloadIntegration */
Integration.downloads.defineModuleGetter(
  this,
  "DownloadIntegration",
  "resource://gre/modules/DownloadIntegration.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  DownloadsCommon: "resource:///modules/DownloadsCommon.jsm",
  FileUtils: "resource://gre/modules/FileUtils.jsm",
  Services: "resource://gre/modules/Services.jsm",
});

class DownloadsCommonParent extends JSWindowActorParent {
  constructor() {
    super();
    // A WeakMap of download objects to uuid's, used to identify
    // updates to downloads in the child.
    this.activeIDs = new WeakMap();
    // A Map of id's to the download objects, used to retrieve
    // the download object when we receive a message from the child.
    this.activeDownloads = new Map();
    // Keep a reference to the download view data so we can remove it
    // when the window is closed.
    this.downloadData = null;
  }

  receiveMessage(aMessage) {
    let topBrowsingContext = this.browsingContext.top;
    let browser = topBrowsingContext.embedderElement;
    let window = browser.ownerGlobal;

    switch (aMessage.name) {
      case "Download:GetData": {
        this.downloadData = DownloadsCommon.getData(
          window,
          aMessage.data.history
        );
        this.downloadData.addView(this);
        break;
      }
      case "Download:LaunchDownload": {
        DownloadIntegration.launchDownload(aMessage.data.download, {});
        break;
      }
      case "Download:DoCommand": {
        let download = this.activeDownloads.get(aMessage.data.download.uuid);
        this.doCommand(aMessage.data.command, download, window);
        break;
      }
    }
  }

  didDestroy() {
    this.downloadData.removeView(this);
  }

  doCommand(command, download, window) {
    switch (command) {
      case "downloadsCmd_cancel": {
        download.cancel();
        download.removePartialData();
        break;
      }
      case "downloadsCmd_retry": {
        if (download.start) {
          download.start();
          return;
        }

        let targetPath = download.target.path
          ? PathUtils.filename(download.target.path)
          : null;
        window.DownloadURL(download.source.url, targetPath, window.document);
        break;
      }
      case "downloadsCmd_show": {
        let file = new FileUtils.File(download.target.path);
        DownloadsCommon.showDownloadedFile(file);
        break;
      }
    }
  }

  onDownloadBatchStarting() {
    this.sendAsyncMessage("Download:onDownloadBatchStarting");
  }

  onDownloadBatchEnded() {
    this.sendAsyncMessage("Download:onDownloadBatchEnded");
  }

  onDownloadAdded(download) {
    let uuid = Services.uuid.generateUUID().toString();
    this.activeIDs.set(download, uuid);
    this.activeDownloads.set(uuid, download);
    download.uuid = uuid;
    this.sendAsyncMessage(
      "Download:onDownloadAdded",
      download.toSerializable()
    );
  }

  onDownloadChanged(download) {
    let uuid = this.activeIDs.get(download);
    download.uuid = uuid;
    this.sendAsyncMessage(
      "Download:onDownloadChanged",
      download.toSerializable()
    );
  }

  onDownloadRemoved(download) {
    let uuid = this.activeIDs.get(download);
    this.activeIDs.remove(download);
    download.uuid = uuid;
    this.activeDownloads.remove(uuid);
    this.sendAsyncMessage(
      "Download:onDownloadRemoved",
      download.toSerializable()
    );
  }
}
