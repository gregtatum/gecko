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

import { makeDaysAgo } from "shared/date";
import { makeFolderNamespacedConvId } from "shared/id_conversions";

/**
 * For details see `README.md`, but the core things to know are:
 * - We synchronize using `singleEvents` with a time window that is
 *   characterized by:
 *   - Our minimum sync buffer: the point at which we abandon our current
 *     syncToken so that we can establish a new sync time window.
 *   - Our sync padding buffer: the amount of time we establish the window into
 *     the future (beyond the minimum sync buffer).  This is done both for the
 *     potential to consult future days (speculative) but also and primarily so
 *     that we're not constantly having to resynchronize.
 * - Our identifiers are the `recurrentEventId` as the conversation id and the
 *   event `id` as the message id and this avoids any need for us to maintain
 *   an additional aggregate mapping here in the sync state.
 *   - However this choice does mean that when it comes time to move our sync
 *     window, we do need to use the `TBL_MSG_IDS_BY_FOLDER` index to help
 *     figure out what data needs to be evicted.
 */
export default class GapiCalFolderSyncStateHelper {
  constructor(ctx, rawSyncState, accountId, folderId, why) {
    logic.defineScope(this, "GapiSyncState", { ctxId: ctx.id, why });

    if (!rawSyncState) {
      logic(ctx, "creatingDefaultSyncState", {});
      rawSyncState = {
        syncToken: null,
        etag: null,
        // The timestamp of the most recent `updated` value for the calendar.
        // This should be used in preference to locally generated wall-clock
        // values when trying to ask the server for things that have changed,
        // specifically via `updatedMin`.
        calUpdatedTS: null,
        rangeOldestTS: makeDaysAgo(15),
        // For now we're syncing ~8 weeks into the future in order to provide
        // some buffer time to make sure the time window shifting is reliable.
        rangeNewestTS: makeDaysAgo(-60),
      };
    }

    this._accountId = accountId;
    this._folderId = folderId;
    this.rawSyncState = rawSyncState;

    // A map grouping events by their `recurringEventId` or for non-recurring
    // events (/ the recurrent event) their own id.  The value is a Map of the
    // instance events keyed by their own id.
    this.eventChangesByRecurringEventId = new Map();

    // A running list of tasks to spin-off
    this.tasksToSchedule = [];
    // A running list of conversations to delete
    this.convMutations = null;
  }

  get syncToken() {
    return this.rawSyncState.syncToken;
  }

  set syncToken(nextSyncToken) {
    this.rawSyncState.syncToken = nextSyncToken;
  }

  get etag() {
    return this.rawSyncState.etag;
  }

  set etag(etag) {
    this.rawSyncState.etag = etag;
  }

  set updatedTime(updatedTimeDateStr) {
    this.rawSyncState.calUpdatedTS = Date.parse(updatedTimeDateStr);
  }

  get timeMinDateStr() {
    return new Date(this.rawSyncState.rangeOldestTS).toISOString();
  }

  get timeMaxDateStr() {
    return new Date(this.rawSyncState.rangeNewestTS).toISOString();
  }

  _makeUidConvTask({
    convId,
    eventMap,
    calUpdatedTS,
    rangeOldestTS,
    rangeNewestTS,
  }) {
    let task = {
      type: "cal_sync_conv",
      accountId: this._accountId,
      folderId: this._folderId,
      convId,
      calUpdatedTS,
      rangeOldestTS,
      rangeNewestTS,
      eventMap,
    };
    this.tasksToSchedule.push(task);
    return task;
  }

  ingestEvent(event) {
    const recurringId = event.recurringEventId || event.id;
    let eventMap = this.eventChangesByRecurringEventId.get(recurringId);
    if (!eventMap) {
      eventMap = new Map();
      this.eventChangesByRecurringEventId.set(recurringId, eventMap);
    }
    eventMap.set(event.id, event);
  }

  /**
   * Statefully process events, generating synchronization tasks as necessary as
   * a byproduct.
   */
  processEvents() {
    for (const [
      recurringId,
      eventMap,
    ] of this.eventChangesByRecurringEventId.entries()) {
      const convId = makeFolderNamespacedConvId(this._folderId, recurringId);
      this._makeUidConvTask({
        convId,
        eventMap,
        calUpdatedTS: this.rawSyncState.calUpdatedTS,
        rangeOldestTS: this.rawSyncState.rangeOldestTS,
        rangeNewestTS: this.rawSyncState.rangeNewestTS,
      });
    }
  }
}
