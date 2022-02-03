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

import { parseGmailFeed } from "../../../parsers/xml/feed_parser";
import { fetchCacheAware } from "../../../utils/network";

import { syncNormalOverlay } from "../../../task_helpers/sync_overlay_helpers";
import GapiCalFolderSyncStateHelper from "../cal_folder_sync_state_helper";

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
      plannedTask.resources = ["online", `happy!${accountId}`];
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

      const syncState = new GapiCalFolderSyncStateHelper(
        ctx,
        rawSyncState,
        req.accountId,
        req.folderId,
        "refresh"
      );

      const syncDate = NOW();
      logic(ctx, "syncStart", { syncDate });

      // ### Fetch the feed.
      const { response, requestCacheState } = await fetchCacheAware(
        "https://mail.google.com/mail/u/0/feed/atom",
        syncState.rawSyncState.inboxFeedCacheState
      );
      syncState.rawSyncState.inboxFeedCacheState = requestCacheState;

      if (!response) {
        logic(ctx, "syncEnd", {});

        // Nothing has changed, just update the last sync date.
        return {
          atomicClobbers: {
            folders: new Map([
              [req.folderId, { lastAttemptedSyncAt: syncDate }],
            ]),
          },
        };
      }

      let unreadMessageCount = 0;
      if (response.ok) {
        const feedText = await response.text();
        unreadMessageCount = parseGmailFeed(feedText)?.feed?.fullcount || 0;
      }

      logic(ctx, "syncEnd", {});

      return {
        atomicClobbers: {
          folders: new Map([
            [
              req.folderId,
              { unreadMessageCount, lastAttemptedSyncAt: syncDate },
            ],
          ]),
        },
      };
    },
  },
]);
