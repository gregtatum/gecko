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
 * Query that filters a folder messages index.
 */
export default function FilteringFolderMessagesQuery({
  ctx,
  db,
  folderId,
  filterRunner,
  rootGatherer,
  preDerivers,
  postDerivers,
}) {
  this._db = db;
  this.folderId = folderId;
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
}
FilteringFolderMessagesQuery.prototype = {
  /**
   * Called by the TOC to initiate the initial fill and receive an initial big
   * glob of stuff.  For now we lie and pretend there are zero things and
   * instead act like everything is dynamic.  Correctness assumes the TOC will
   * promptly invoke bind() or we'll start firing notifications into the ether.
   * (This currently holds.)
   */
  async execute() {
    let idsWithDates;
    ({
      idsWithDates,
      drainEvents: this._drainEvents,
      eventId: this._eventId,
    } = await this._db.loadFolderMessageIdsAndListen(this.folderId));

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

    return [];
  },

  /**
   * Bind the listener for TOC changes, including immediately draining all
   * buffered events that were fired between the time the DB query was issued
   * and now.
   */
  bind(listenerObj, listenerMethod) {
    this._boundListener = listenerMethod.bind(listenerObj);
    this._db.on(this._eventId, this._bound_filteringTOCChange);
    this._drainEvents(this._bound_filteringTOCChange);
    this._drainEvents = null;
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
    this._db.removeListener(this._eventId, this._bound_filteringTOCChange);
    this._filteringStream.destroy();
  },
};
