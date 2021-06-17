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

import TaskDefiner from "../../../task_infra/task_definer";

import SyncStateHelper from "../sync_state_helper";

import { POP3_MAX_MESSAGES_PER_SYNC } from "../../../syncbase";

/**
 * Sync some messages out of the the overflow set.
 */
export default TaskDefiner.defineSimpleTask([
  {
    name: "sync_grow",

    exclusiveResources(args) {
      return [`sync:${args.accountId}`];
    },

    priorityTags(args) {
      return [`view:folder:${args.folderId}`];
    },

    async execute(ctx, req) {
      // -- Exclusively acquire the sync state for the folder
      let fromDb = await ctx.beginMutate({
        syncStates: new Map([[req.accountId, null]]),
      });
      let rawSyncState = fromDb.syncStates.get(req.accountId);
      let syncState = new SyncStateHelper(
        ctx,
        rawSyncState,
        req.accountId,
        "refresh",
        POP3_MAX_MESSAGES_PER_SYNC
      );

      // -- Establish the connection
      // We don't actually need this right now because we're not doing deletion
      // inference against the set of messages we're growing to include.  But
      // we ideally would do that.  And it makes sense to prime the connection
      // while we're in here.
      // TODO: deletion inference here (rather than relying on refresh and
      // error handling in sync_message to handle things.)
      let account = await ctx.universe.acquireAccount(ctx, req.accountId);
      let popAccount = account.popAccount;

      // as per the above, we're intentionally doing this just for side-effects.
      await popAccount.ensureConnection();

      syncState.syncOverflowMessages(POP3_MAX_MESSAGES_PER_SYNC);

      await ctx.finishTask({
        mutations: {
          syncStates: new Map([[req.accountId, syncState.rawSyncState]]),
          umidNames: syncState.umidNameWrites,
          umidLocations: syncState.umidLocationWrites,
        },
        newData: {
          tasks: syncState.tasksToSchedule,
        },
      });
    },
  },
]);
