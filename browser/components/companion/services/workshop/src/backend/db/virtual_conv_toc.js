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

import logic from "logic";

import { ConversationTOC } from "./conv_toc";

/**
 * A virtual conversation is like a conversation but with some messages coming
 * from differents folders, conversations...
 * In other words, it's just a kind of bag with whatever you want inside.
 *
 * Since the messages can belongs to different account, folders, ... we must
 * update what we've to update (e.g. folders to refresh).
 */
export class VirtualConversationTOC extends ConversationTOC {
  #refreshHelperMaker;
  #metaHelperMaker;

  constructor({
    db,
    query,
    dataOverlayManager,
    metaHelpers,
    refreshHelpers = null,
    refreshHelperMaker,
    metaHelperMaker,
    onForgotten,
  }) {
    super({
      db,
      query,
      dataOverlayManager,
      metaHelpers,
      refreshHelpers,
      onForgotten,
    });
    db.on("fldr!*!remove", this.onFolderDeletion.bind(this));
    db.on("fldr!*!add", this.onFolderAddition.bind(this));

    this.#refreshHelperMaker = refreshHelperMaker;
    this.#metaHelperMaker = metaHelperMaker;

    logic.defineScope(this, "VirtualConversationTOC");
  }

  onFolderDeletion(folderId) {
    this.refreshHelpers.delete(folderId);
    if (this._everActivated && this.metaHelpers.has(folderId)) {
      this.metaHelpers.get(folderId).deactivate(this);
      this.metaHelpers.delete(folderId);
    }
  }

  onFolderAddition(folderId) {
    if (!this.refreshHelpers.has(folderId)) {
      this.refreshHelpers.set(folderId, this.#refreshHelperMaker(folderId));
    }
    if (this._everActivated && !this.metaHelpers.has(folderId)) {
      const metaHelper = this.#metaHelperMaker(folderId);
      this.metaHelpers.set(folderId, metaHelper);
      metaHelper.activate(this);
    }
  }
}
