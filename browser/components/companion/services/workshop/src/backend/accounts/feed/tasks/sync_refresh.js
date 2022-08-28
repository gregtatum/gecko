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

import { parseHFeedFromUrl } from "../../../parsers/html/feed_parser";
import { parseJsonFeed } from "../../../parsers/json/feed_parser";
import { fetchCacheAware } from "../../../utils/network";
import { parseFeed } from "../../../parsers/xml/feed_parser";

import { shallowClone } from "shared/util";
import { NOW } from "shared/date";

import TaskDefiner from "../../../task_infra/task_definer";

import SyncStateHelper from "../sync_state_helper";

import { accountIdFromFolderId } from "shared/id_conversions";

import {
  syncNormalOverlay,
  syncPrefixOverlay,
} from "../../../task_helpers/sync_overlay_helpers";

/**
 * Sync a folder for the first time and steady-state.  See `../sync.md` for some
 * info.
 *
 * ## Dynamic Folders / Labels
 *
 */
export default TaskDefiner.defineAtMostOnceTask([
  {
    name: "sync_refresh",
    binByArg: "accountId",

    helped_overlay_accounts: syncNormalOverlay,

    /**
     * We will match folders that belong to our account, allowing us to provide
     * overlay data for folders even though we are account-centric.
     * Our overlay push happens indirectly by us announcing on
     * 'accountCascadeToFolders' which causes the folders_toc to generate the
     * overlay pushes for all impacted folders.
     */
    helped_prefix_overlay_folders: [accountIdFromFolderId, syncPrefixOverlay],

    helped_invalidate_overlays(accountId, dataOverlayManager) {
      dataOverlayManager.announceUpdatedOverlayData("accounts", accountId);
      dataOverlayManager.announceUpdatedOverlayData(
        "accountCascadeToFolders",
        accountId
      );
    },

    helped_already_planned(ctx, rawTask) {
      // The group should already exist; opt into its membership to get a
      // Promise
      return Promise.resolve({
        result: ctx.trackMeInTaskGroup("sync_refresh:" + rawTask.accountId),
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
      // Let our triggering folder's viewing give us a priority boost, Although
      // perhaps this should just be account granularity?
      plannedTask.priorityTags = [`view:folder:${rawTask.folderId}`];

      // Create a task group that follows this task and all its offspring.  This
      // will define the lifetime of our overlay as well.
      let groupPromise = ctx.trackMeInTaskGroup(
        "sync_refresh:" + rawTask.accountId
      );
      return Promise.resolve({
        taskState: plannedTask,
        remainInProgressUntil: groupPromise,
        result: groupPromise,
      });
    },

    async helped_execute(ctx, req) {
      // -- Exclusively acquire the sync state for the account
      let fromDb = await ctx.beginMutate({
        syncStates: new Map([[req.accountId, null]]),
      });
      let rawSyncState = fromDb.syncStates.get(req.accountId);
      let syncState = new SyncStateHelper(
        ctx,
        rawSyncState,
        req.accountId,
        "refresh"
      );

      let account = await ctx.universe.acquireAccount(ctx, req.accountId);

      let syncDate = NOW();

      logic(ctx, "syncStart", { syncDate });

      if (account.feedType === "html") {
        const parsed = await parseHFeedFromUrl(account.feedUrl);
        for (const entry of parsed.entries) {
          syncState.ingestHEntry(entry);
        }
      } else {
        // ### Fetch the feed.
        const { response, requestCacheState } = await fetchCacheAware(
          account.feedUrl,
          syncState.rawSyncState.requestCacheState
        );
        syncState.rawSyncState.requestCacheState = requestCacheState;

        if (!response) {
          logic(ctx, "syncEnd", {});
          return null;
        }

        const feedText = await response.text();
        const parsed =
          account.feedType === "json"
            ? parseJsonFeed(feedText)
            : parseFeed(feedText);

        if (parsed?.rss?.channel.item) {
          for (const item of parsed.rss.channel.item) {
            syncState.ingestItem(item);
          }
        } else if (parsed?.feed?.entry) {
          for (const entry of parsed.feed.entry) {
            syncState.ingestEntry(entry);
          }
        } else if (parsed?.entry) {
          syncState.ingestEntry(parsed.entry);
        } else if (parsed?.items) {
          for (const item of parsed.items) {
            syncState.ingestJsonItem(item);
          }
        }
      }
      logic(ctx, "syncEnd", {});

      return {
        mutations: {
          syncStates: new Map([[req.accountId, syncState.rawSyncState]]),
        },
        newData: {
          tasks: syncState.tasksToSchedule,
        },
        atomicClobbers: {
          accounts: new Map([
            [
              req.accountId,
              {
                syncInfo: {
                  lastSuccessfulSyncAt: syncDate,
                  lastAttemptedSyncAt: syncDate,
                  failedSyncsSinceLastSuccessfulSync: 0,
                },
              },
            ],
          ]),
        },
      };
    },
  },
]);
