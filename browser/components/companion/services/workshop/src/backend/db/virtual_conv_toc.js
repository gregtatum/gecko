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
import { accountIdFromMessageId } from "../../shared/id_conversions";

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
  #metadataRefresher;
  #metaHelperMaker;
  #visibleItemIds;
  #onFolderDeletion_bound;
  #onFolderAddition_bound;
  #onItemAdded_bound;
  #onItemRemoved_bound;
  #onItemChanged_bound;
  #onAccountChange_bound;
  #id;
  static _globalId = 0;

  constructor({
    db,
    query,
    dataOverlayManager,
    metaHelpers,
    metadataRefresher,
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

    this.#id = VirtualConversationTOC._globalId++;

    this.#onFolderDeletion_bound = this.onFolderDeletion.bind(this);
    this.#onFolderAddition_bound = this.onFolderAddition.bind(this);
    this.#onAccountChange_bound = this.onAccountChange.bind(this);

    this.#refreshHelperMaker = refreshHelperMaker;
    this.#metaHelperMaker = metaHelperMaker;
    this.#metadataRefresher = metadataRefresher;

    this.#visibleItemIds = new Map();
    this.#onItemAdded_bound = this.onItemAdded.bind(this);
    this.#onItemRemoved_bound = this.onItemRemoved.bind(this);
    this.#onItemChanged_bound = this.onItemChanged.bind(this);

    db.on("fldr!*!remove", this.#onFolderDeletion_bound);
    db.on("fldr!*!add", this.#onFolderAddition_bound);
    db.on("accounts!tocChange", this.#onAccountChange_bound);
    db.on("msg!*!change", this.#onItemChanged_bound);

    logic.defineScope(this, "VirtualConversationTOC");
  }

  async __activateTOC() {
    this.query.addPostDeriver({
      itemAdded: this.#onItemAdded_bound,
      itemRemoved: this.#onItemRemoved_bound,
    });
    await super.__activateTOC();
  }

  __deactivateTOC(firstTime) {
    super.__deactivateTOC(firstTime);
    if (!firstTime) {
      this.db.removeListener("fldr!*!remove", this.#onFolderDeletion_bound);
      this.db.removeListener("fldr!*!add", this.#onFolderAddition_bound);
      this.db.removeListener("accounts!tocChange", this.#onAccountChange_bound);
      this.db.removeListener("msg!*!change", this.#onItemChanged_bound);
      this.#visibleItemIds.clear();
    }
  }

  onAccountChange(accountId, accountDef) {
    if (accountDef) {
      return;
    }

    // We've an account deletion, so we must remove all the messages which
    // could be there.
    for (const id of [...this.#visibleItemIds.keys()]) {
      if (accountIdFromMessageId(id) === accountId) {
        this.#visibleItemIds.delete(id);
      }
    }
  }

  onItemChanged(messageId, preInfo, message) {
    if (!message) {
      this.onItemRemoved(messageId);
      return;
    }

    if (preInfo.date !== message.date && this.#visibleItemIds.has(messageId)) {
      // The date change so the key [id, date] changed so must update the entry.
      this.#visibleItemIds.set(messageId, message.date);
    }
  }

  onItemAdded(gathered) {
    // When an event is brought into the view.
    this.#visibleItemIds.set(gathered.message.id, gathered.message.date);
    this.refreshMetadata();
  }

  onItemRemoved(id) {
    // When an event is removed from the view.
    this.#visibleItemIds.delete(id);
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

  async refreshMetadata(why) {
    await this.#metadataRefresher(this.#visibleItemIds, this.#id, why);
  }

  async refresh(why) {
    await Promise.all([this.refreshMetadata(why), super.refresh(why)]);
  }
}
