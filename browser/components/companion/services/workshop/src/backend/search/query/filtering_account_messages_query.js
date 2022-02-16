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

import FilteringStream from "../filtering_stream";

/**
 * Query that filters an account messages index.
 */
export default function FilteringAccountMessagesQuery({
  ctx,
  db,
  folderIds,
  filterRunner,
  rootGatherer,
  preDerivers,
  postDerivers,
}) {
  this._db = db;
  this.folderIds = folderIds;
  this._eventId = null;
  this._drainEvents = null;
  this._boundListener = null;

  this._filteringStream = new FilteringStream({
    ctx,
    filterRunner,
    rootGatherer,
    preDerivers,
    postDerivers,
    isDeletion: change => {
      return !change.postDate;
    },
    inputToGatherInto: change => {
      return {
        messageId: change.id,
        date: change.postDate,
      };
    },
    mutateChangeToResembleAdd: change => {
      change.preDate = null;
      change.freshlyAdded = true;
    },
    mutateChangeToResembleDeletion: change => {
      change.preDate = change.postDate;
      change.postDate = 0;
      change.item = null;
      change.freshlyAdded = false;
    },
    onFilteredUpdate: change => {
      this._boundListener(change);
    },
  });

  this._bound_filteringTOCChange = this._filteringTOCChange.bind(this);

  this._bound_onFolderRemove = this.onFolderRemove.bind(this);
  this._db.on("fldr!*!remove", this._bound_onFolderRemove);
  this._bound_onFolderAdd = this.onFolderAdd.bind(this);
  this._db.on("fldr!*!add", this._bound_onFolderAdd);
}
FilteringAccountMessagesQuery.prototype = {
  /**
   * Called by the TOC to initiate the initial fill and receive an initial big
   * glob of stuff.  For now we lie and pretend there are zero things and
   * instead act like everything is dynamic.  Correctness assumes the TOC will
   * promptly invoke bind() or we'll start firing notifications into the ether.
   * (This currently holds.)
   */
  async execute() {
    this._drainEvents = [];
    this._eventId = [];

    const data = await Promise.all(
      this.folderIds.map(folderId =>
        this._db.loadFolderMessageIdsAndListen(folderId)
      )
    );

    for (const { idsWithDates, drainEvents, eventId } of data) {
      this._drainEvents.push(drainEvents);
      this._eventId.push(eventId);

      for (const { id, date } of idsWithDates) {
        this._filteringStream.consider({
          id,
          preDate: null,
          postDate: date,
          item: null,
          freshlyAdded: true,
          matchInfo: null,
        });
      }
    }

    return [];
  },

  /**
   * Bind the listener for TOC changes, including immediately draining all
   * buffered events that were fired between the time the DB query was issued
   * and now.
   */
  bind(listenerObj, listenerMethod) {
    this._boundListener = listenerMethod.bind(listenerObj);
    for (const eventId of this._eventId) {
      this._db.on(eventId, this._bound_filteringTOCChange);
    }
    for (const drainEvents of this._drainEvents) {
      drainEvents(this._bound_filteringTOCChange);
    }
    this._drainEvents = null;
  },

  onFolderRemove(folderId) {
    let idx = this.folderIds.indexOf(folderId);
    if (idx !== -1) {
      this.folderIds.splice(idx, 1);
    }

    const eventId = this._db.messageEventForFolderId(folderId);
    idx = this._eventId.indexOf(eventId);
    if (idx !== -1) {
      this._eventId.splice(idx, 1);
      this._db.removeListener(eventId, this._bound_filteringTOCChange);
    }
  },

  async onFolderAdd(folderId) {
    const idx = this.folderIds.indexOf(folderId);
    if (idx === -1) {
      this.folderIds.push(folderId);
      const {
        idsWithDates,
        drainEvents,
        eventId,
      } = await this._db.loadFolderMessageIdsAndListen(folderId);

      drainEvents(this._bound_filteringTOCChange);
      this._eventId.push(eventId);
      this._db.on(eventId, this._bound_filteringTOCChange);

      for (const { id, date } of idsWithDates) {
        this._filteringStream.consider({
          id,
          preDate: null,
          postDate: date,
          item: null,
          freshlyAdded: true,
          matchInfo: null,
        });
      }
    }
  },

  /**
   * Events from the database about the folder we're filtering on.  We cram
   * these into the filtering stream.
   */
  _filteringTOCChange(change) {
    this._filteringStream.consider(change);
  },

  /**
   * Tear down everything.  Query's over.
   */
  destroy() {
    for (const eventId of this._eventId) {
      this._db.removeListener(eventId, this._bound_filteringTOCChange);
    }
    this._filteringStream.destroy();
    this._db.removeListener("fldr!*!remove", this._bound_onFolderRemove);
    this._db.removeListener("fldr!*!add", this._bound_onFolderAdd);
  },
};
