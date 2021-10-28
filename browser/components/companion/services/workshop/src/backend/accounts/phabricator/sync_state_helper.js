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

import { millisecsToSeconds, makeDaysAgo } from "shared/date";
import { makeGlobalNamespacedConvId } from "shared/id_conversions";

/**
 * See `sync.md`.
 */
export default class PhabricatorSyncStateHelper {
  constructor(ctx, rawSyncState, accountId, why) {
    logic.defineScope(this, "PhabricatorSyncState", { ctxId: ctx.id, why });

    if (!rawSyncState) {
      logic(ctx, "creatingDefaultSyncState", {});
      const startSyncFrom_millis = makeDaysAgo(7);
      const startSyncFrom_secs = millisecsToSeconds(startSyncFrom_millis);

      rawSyncState = {
        lastDateModifiedEpochSecs: startSyncFrom_secs,
        firstDateModifiedEpochSecs: startSyncFrom_secs,
      };
    }

    this._accountId = accountId;
    this.rawSyncState = rawSyncState;

    // A running list of tasks to spin-off
    this.tasksToSchedule = [];
  }

  _makeDrevConvTask({ drevId, drevPhid, modifiedStamp }) {
    const convId = makeGlobalNamespacedConvId(this._accountId, drevId);
    const task = {
      type: "sync_drev",
      accountId: this._accountId,
      convId,
      drevPhid,
      modifiedStamp,
    };
    this.tasksToSchedule.push(task);
    return task;
  }

  /**
   * Mark a DREV for further synchronization.  We don't care if we knew about
   * it before or not.
   */
  foundDrev(drevInfo) {
    this._makeDrevConvTask(drevInfo);
  }
}
