/**
 * Copyright 2021 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EntireListView } from "./entire_list_view";
import { MailFolder } from "./mail_folder";

export class FoldersListView extends EntireListView {
  constructor(api, handle) {
    super(api, MailFolder, handle);

    // enable use of latestOnce('inbox').  Note that this implementation assumes
    // the inbox is eternal.  This is generally a safe assumption, but since this
    // is a secret implementation right now, please do consider your risk profile
    // as you read this code and uncover its dark secrets.
    this.inbox = null;
    const inboxListener = mailFolder => {
      if (mailFolder.type === "inbox") {
        this.inbox = mailFolder;
        this.removeListener("add", inboxListener);
        this.emit("inbox", mailFolder);
      }
    };
    this.on("add", inboxListener);

    this._firstWithTypeCache = new Map();
  }
  /**
   * Get a folder with the given id right now, returning null if we can't find it.
   * If you expect the folder exists but you may be running in the async startup
   * path, you probably want eventuallyGetFolderById.
   */
  getFolderById(id) {
    return this.items.find(folder => folder.id === id) || null;
  }
  /**
   * Promise-returning folder resolution.
   */
  eventuallyGetFolderById(id) {
    return new Promise((resolve, reject) => {
      const existingFolder = this.getFolderById(id);
      if (existingFolder) {
        resolve(existingFolder);
        return;
      }
      // If already completed, immediately reject.
      if (this.complete) {
        reject("already complete");
        return;
      }

      // Otherwise we're still loading and we'll either find victory in an add or
      // inferred defeat when we get the completion notification.
      const addListener = folder => {
        if (folder.id === id) {
          this.removeListener("add", addListener);
          resolve(folder);
        }
      };

      const completeListener = () => {
        this.removeListener("add", addListener);
        this.removeListener("complete", completeListener);
        reject("async complete");
      };

      this.on("add", addListener);
      this.on("complete", completeListener);
    });
  }
  getFirstFolderWithType(type) {
    // allow an explicit list of items to be provided, specifically for use in
    // onsplice handlers where the items have not yet been spliced in.
    let item = this._firstWithTypeCache.get(type);
    if (!item) {
      item = this.items.find(folder => folder.type === type) || null;
      this._firstWithTypeCache.set(type, item);
    }
    return item;
  }
  getFirstFolderWithName(name, items) {
    return (items || this.items).find(folder => folder.name === name) || null;
  }
  getFirstFolderWithPath(path, items) {
    return (items || this.items).find(folder => folder.path === path) || null;
  }
}
