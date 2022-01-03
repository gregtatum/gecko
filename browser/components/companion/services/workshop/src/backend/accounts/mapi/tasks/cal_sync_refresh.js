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
import { MapiBackoffInst } from "../account";

/**
 * Sync a Google API Calendar, which under our scheme corresponds to a single
 * folder.
 */
export default TaskDefiner.defineAtMostOnceTask([
  {
    name: "sync_refresh",
    binByArg: "folderId",

    helped_overlay_folders: syncNormalOverlay,

    helped_invalidate_overlays(folderId, dataOverlayManager) {
      dataOverlayManager.announceUpdatedOverlayData("folders", folderId);
    },

    helped_already_planned(ctx, rawTask) {
      // The group should already exist; opt into its membership to get a
      // Promise
      return Promise.resolve({
        result: ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.folderId),
      });
    },

    helped_plan(ctx, rawTask) {
      // - Plan!
      let plannedTask = shallowClone(rawTask);
      plannedTask.resources = [
        "online",
        `credentials!${rawTask.accountId}`,
        `happy!${rawTask.accountId}`,
      ];
      plannedTask.priorityTags = [`view:folder:${rawTask.folderId}`];

      // Create a task group that follows this task and all its offspring.  This
      // will define the lifetime of our overlay as well.
      let groupPromise = ctx.trackMeInTaskGroup(
        "sync_refresh:" + rawTask.folderId
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
      const folderInfo = account.foldersTOC.foldersById.get(req.folderId);

      const calendarId = folderInfo.serverId;

      let syncDate = NOW();
      logic(ctx, "syncStart", { syncDate });

      const params = Object.create(null);
      let endpoint;
      if (syncState.syncUrl) {
        endpoint = syncState.syncUrl;
      } else {
        endpoint = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView/delta`;
        if (syncState.timeMinDateStr && syncState.timeMaxDateStr) {
          params.startDateTime = syncState.timeMinDateStr;
          params.endDateTime = syncState.timeMaxDateStr;
        }
      }

      const apiCallArguments = [
        endpoint,
        params,
        "value",
        result =>
          result["@odata.nextLink"]
            ? {
                url: result["@odata.nextLink"],
              }
            : null,
        MapiBackoffInst,
      ];
      let results = await account.client.pagedApiGetCall(...apiCallArguments);

      if (syncState.syncUrl && results.error) {
        // Maybe the something expired here so just retry without using the
        // @odata.nextLink.
        apiCallArguments[0] = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView/delta`;
        if (syncState.timeMinDateStr && syncState.timeMaxDateStr) {
          params.startDateTime = syncState.timeMinDateStr;
          params.endDateTime = syncState.timeMaxDateStr;
        }
        results = await account.client.pagedApiGetCall(...apiCallArguments);
      }

      let syncInfoClobbers;
      if (results.error) {
        logic(ctx, "syncError", { error: results.error });

        syncInfoClobbers = {
          lastAttemptedSyncAt: syncDate,
          // XXX this should theoretically be an atomicDelta, not a clobber...
          // That said, this is harmless since we have exclusive ownership over
          // this field, as opposed to unread counts for folders which can have
          // multiple incidental writers, etc.
          failedSyncsSinceLastSuccessfulSync:
            folderInfo.failedSyncsSinceLastSuccessfulSync + 1,
        };
      } else {
        for (const event of results.value) {
          syncState.ingestEvent(event);
        }

        // Update sync state before processing the batch; things like the
        // calUpdatedTS need to be available.
        syncState.syncUrl = results["@odata.deltaLink"];
        syncState.updatedTime = results.updatedTime;
        syncState.updatedTime = syncDate;

        syncState.processEvents();

        logic(ctx, "syncEnd", {});

        syncInfoClobbers = {
          lastSuccessfulSyncAt: syncDate,
          lastAttemptedSyncAt: syncDate,
          failedSyncsSinceLastSuccessfulSync: 0,
        };
      }

      return {
        mutations: {
          syncStates: new Map([[req.folderId, syncState.rawSyncState]]),
        },
        newData: {
          tasks: syncState.tasksToSchedule,
        },
        atomicClobbers: {
          folders: new Map([
            [
              req.folderId,
              {
                syncInfo: syncInfoClobbers,
              },
            ],
          ]),
        },
      };
    },
  },
]);
