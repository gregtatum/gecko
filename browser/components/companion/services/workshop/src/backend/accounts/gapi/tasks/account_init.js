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
import { shallowClone } from "shared/util";
import { EVENT_OUTSIDE_SYNC_RANGE, NOW } from "shared/date";

import TaskDefiner from "../../../task_infra/task_definer";
import GapiCalFolderSyncStateHelper from "../cal_folder_sync_state_helper";

/**
 * Sync all the Google API Calendars for the current day.
 * It's only used when the account is created.
 *
 * One could say "it's a bit a dup of sync_refresh" which is correct.
 * But in daily usage we should have few events to sync (most of time none)
 * so it doesn't hurt to run refresh sequentially, get the few events, get doc
 * titles, ...
 * But when the account is created we've to deal with potentially a large amount
 * of data and since everything here is almost running sequentially it can take
 * a while. So we just get all the different calendars in an async way.
 *
 * TODO: we're still getting the document titles sequentially and it introduces
 * some slowness so we should find out a way to deal with that stuff:
 *  - make an aysnc removal of all the titles;
 *  - add a task to get titles in a second shot in prioritizing events which are
 *    in the view.
 * Likely, the second one is a way more interesting and could be useful to update
 * titles in general.
 *
 * Because this task will be followed by a sync_refresh task whose sync range
 * will entirely encompass our single-day sync range here and the sync logic
 * knows how to gracefully handle being told about events it already knows about,
 * sync state correctness is largely maintained. The one potential situation
 * that could arise is if a calendar event is deleted between when this task
 * runs and when sync_refresh runs. In that case, the user will have a stale
 * calendar entry.
 * This can likely be addressed in the future when making sync_refresh and
 * GapiCalFolderSyncStateHelper handle changes in the sync window. In that case,
 * this task can instead be replaced by having sync_refresh operate with a
 * single-day sync range which then gets upgraded to have a larger sync range.
 */

export default TaskDefiner.defineSimpleTask([
  {
    name: "account_init",
    args: ["accountId"],

    plan(ctx, rawTask) {
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
      plannedTask.priorityTags = [`view:account:${rawTask.accountId}`];

      // Create a task group that follows this task and all its offspring.  This
      // will define the lifetime of our overlay as well.
      const groupPromise = ctx.trackMeInTaskGroup(`account_init:${accountId}`);
      return ctx.finishTask({
        taskState: plannedTask,
        remainInProgressUntil: groupPromise,
        result: groupPromise,
      });
    },

    async execute(ctx, req) {
      const account = await ctx.universe.acquireAccount(ctx, req.accountId);
      const folders = account.foldersTOC.items;

      const syncDate = NOW();
      const todayTS = makeDaysAgo(0);
      const tomorrowTS = makeDaysAgo(-1);

      logic(ctx, "accountInitialization", { syncDate });

      const syncState = new GapiCalFolderSyncStateHelper(
        ctx,
        null,
        req.accountId,
        "",
        "init"
      );
      syncState.rawSyncState.rangeNewestTS = tomorrowTS;
      syncState.rawSyncState.rangeOldestTS = todayTS;

      const params = {
        singleEvents: true,
        timeMin: syncState.timeMinDateStr,
        timeMax: syncState.timeMaxDateStr,
        // About maxAttendees: see TODO in sync_refresh.js.
        maxAttendees: 50,
      };

      const allResults = await Promise.allSettled(
        folders.map(async folder => {
          if (!folder.serverId) {
            return null;
          }
          const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${folder.serverId}/events`;
          return account.client.pagedApiGetCall(
            endpoint,
            params,
            "items",
            result =>
              result.nextPageToken
                ? {
                    params: { pageToken: result.nextPageToken },
                  }
                : null
          );
        })
      );

      for (let i = 0; i < folders.length; i++) {
        if (allResults[i].status !== "fulfilled") {
          // Don't handle errors: if something is really wrong we'll see it
          // in sync_refresh task.
          continue;
        }
        const results = allResults[i].value;
        if (!results || !results.items) {
          continue;
        }
        const folder = folders[i];
        syncState.folderId = folder.id;

        // This is the highest possible priority: we want to ensure that all the
        // event got here are treated before any other tasks.
        const priority = folder.primary ? 99999 : 99998;

        for (const event of results.items) {
          if (event.start && event.end) {
            const startDate = new Date(
              event.start.dateTime || event.start.date
            ).valueOf();
            const endDate = new Date(
              event.end.dateTime || event.end.date
            ).valueOf();

            if (
              EVENT_OUTSIDE_SYNC_RANGE(
                { startDate, endDate },
                syncState.rawSyncState
              )
            ) {
              // It's a mystery but some events aren't in the requested range.
              // It's possible to have some events happening in 23 years!!
              continue;
            }
          }

          if (event.visibility === "private" && !event.attendees) {
            // From documentation:
            //   The event is private and only event attendees may view event
            //   details.
            // So if attendees is empty there are no chance to have something
            // interesting.
            continue;
          }

          syncState.ingestEvent(event, priority);
        }

        syncState.processEvents();
      }

      logic(ctx, "accountInitializationEnd", {});

      await ctx.finishTask({
        newData: {
          tasks: syncState.tasksToSchedule,
        },
      });
    },
  },
]);
