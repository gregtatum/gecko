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
import { makeGlobalNamespacedConvId } from "shared/id_conversions";

/**
 * See `sync.md`.
 */
export default class BugzillaSyncStateHelper {
  constructor(ctx, rawSyncState, accountId, why) {
    logic.defineScope(this, "BugzillaSyncState", { ctxId: ctx.id, why });

    if (!rawSyncState) {
      logic(ctx, "creatingDefaultSyncState", {});
      // During initial development we're using a week as the horizon, but once
      // this seems sufficiently stable, this should probably be at least a
      // month and probably actually much longer.
      const startSyncFrom_millis = makeDaysAgo(30);

      rawSyncState = {
        lastChangeDatestamp: startSyncFrom_millis,
        // The bugzilla search mechanism doesn't actually have a way of creating
        // this constraint on queries for the grow situation, but we can ignore
        // results with a last_changed_time that are newer than than this when
        // browing backwards.  (Noting that because it's not possible to
        // backdate bugzilla changes, we don't have to worry about timestamps
        // between the first and last because inductively we've already synced
        // those bugs and the only change that can happen is that they can be
        // "touched" and move to be more recent than the last change.)
        firstChangeDatestamp: startSyncFrom_millis,
      };
    }

    this._accountId = accountId;
    this.rawSyncState = rawSyncState;

    // A running list of tasks to spin-off
    this.tasksToSchedule = [];
  }

  _makeBugConvTask({ bugId, lastChangeDatestamp }) {
    const convId = makeGlobalNamespacedConvId(this._accountId, `${bugId}`);
    const task = {
      type: "sync_bug",
      accountId: this._accountId,
      convId,
      bugId,
      lastChangeDatestamp,
    };
    this.tasksToSchedule.push(task);
    return task;
  }

  /**
   * Mark a DREV for further synchronization.  We don't care if we knew about
   * it before or not.
   */
  foundBug(drevInfo) {
    this._makeBugConvTask(drevInfo);
  }
}
