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

import { shallowClone } from "shared/util";
import { NOW } from "shared/date";

import TaskDefiner from "../../../task_infra/task_definer";

import { syncNormalOverlay } from "../../../task_helpers/sync_overlay_helpers";
import MapiCalFolderSyncStateHelper from "../cal_folder_sync_state_helper";
import { prepareChangeForProblems } from "../../../utils/tools";

/**
 * Sync a Google API Calendar, which under our scheme corresponds to a single
 * folder.
 */
export default TaskDefiner.defineAtMostOnceTask([
  {
    name: "sync_inbox_refresh",
    binByArg: "folderId",

    helped_overlay_folders: syncNormalOverlay,

    helped_invalidate_overlays(folderId, dataOverlayManager) {
      dataOverlayManager.announceUpdatedOverlayData("folders", folderId);
    },

    helped_already_planned(ctx, rawTask) {
      // The group should already exist; opt into its membership to get a
      // Promise
      return Promise.resolve({
        result: ctx.trackMeInTaskGroup(
          "sync_inbox_refresh:" + rawTask.folderId
        ),
      });
    },

    helped_plan(ctx, rawTask) {
      // - Plan!
      let plannedTask = shallowClone(rawTask);
      const { accountId } = rawTask;
      plannedTask.resources = [
        "online",
        `credentials!${accountId}`,
        `happy!${accountId}`,
        `permissions!${accountId}`,
        `queries!${accountId}`,
      ];
      plannedTask.priorityTags = [`view:folder:${rawTask.folderId}`];

      // Create a task group that follows this task and all its offspring.  This
      // will define the lifetime of our overlay as well.
      let groupPromise = ctx.trackMeInTaskGroup(
        "sync_inbox_refresh:" + rawTask.folderId
      );
      return {
        taskState: plannedTask,
        remainInProgressUntil: groupPromise,
        result: groupPromise,
      };
    },

    async helped_execute(ctx, req) {
      // -- Exclusively acquire the sync state for the folder
      const fromDb = await ctx.beginMutate({
        syncStates: new Map([[req.folderId, null]]),
      });

      const rawSyncState = fromDb.syncStates.get(req.folderId);

      const syncState = new MapiCalFolderSyncStateHelper(
        ctx,
        rawSyncState,
        req.accountId,
        req.folderId,
        "refresh"
      );

      const account = await ctx.universe.acquireAccount(ctx, req.accountId);

      const syncDate = NOW();
      logic(ctx, "syncStart", { syncDate });

      /**
       * TODO: The url below uses '$filter=isRead ne true&count=true', this is
       * likely sub-optimal and we could use:
       *   https://graph.microsoft.com/v1.0/me/mailFolders/Inbox
       * and then get the number of unread emails in using the property
       * `unreadItemCount` (for more info have a look on
       * https://docs.microsoft.com/en-us/graph/api/resources/mailfolder?view=graph-rest-1.0#properties)
       */
      const endpoint =
        "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=isRead ne true&$count=true&$select=id,webLink&top=1";
      const changes = {
        atomicClobbers: {},
      };
      let results;

      try {
        results = await account.client.apiGetCall(endpoint, {} /* params */);
      } catch (e) {
        // Critical error.
        logic(ctx, "syncError", { error: e.message });
        changes.atomicClobbers.accounts = prepareChangeForProblems(
          account,
          e.problem
        );

        return changes;
      }

      if (!results || results.error) {
        logic(ctx, "syncError", { error: results?.error || "No data" });
        return {};
      }

      const unreadMessageCount = results?.["@odata.count"] ?? 0;
      const webLink = results?.value?.[0]?.webLink?.split("?", 1)?.[0] || null;
      syncState.updatedTime = syncDate;

      logic(ctx, "syncEnd", {});

      if (account.problems) {
        changes.atomicClobbers.accounts = prepareChangeForProblems(
          account,
          null
        );
      }

      changes.atomicClobbers.folders = new Map([
        [
          req.folderId,
          {
            unreadMessageCount,
            webLink,
            lastAttemptedSyncAt: syncDate,
          },
        ],
      ]);

      return changes;
    },
  },
]);
