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
import { NOW } from "shared/date";

import TaskDefiner from "../../../task_infra/task_definer";
import MapiCalFolderSyncStateHelper from "../cal_folder_sync_state_helper";

/**
 * Sync all the Microsoft api Calendars for the current day.
 * It's only used when the account is created.
 *
 * See the comment for the gapi counterpart.
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

      const syncState = new MapiCalFolderSyncStateHelper(
        ctx,
        null,
        req.accountId,
        "",
        "init"
      );
      syncState.rawSyncState.rangeNewestTS = tomorrowTS;
      syncState.rawSyncState.rangeOldestTS = todayTS;

      const params = {
        startDateTime: syncState.timeMinDateStr,
        endDateTime: syncState.timeMaxDateStr,
      };

      const allResults = await Promise.allSettled(
        folders.map(async folder => {
          if (!folder.serverId) {
            return null;
          }
          const endpoint = `https://graph.microsoft.com/v1.0/me/calendars/${folder.serverId}/calendarView`;
          return account.client.pagedApiGetCall(
            endpoint,
            params,
            "value",
            result =>
              result["@odata.nextLink"]
                ? {
                    url: result["@odata.nextLink"],
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
        if (!results) {
          continue;
        }
        const folder = folders[i];
        syncState.folderId = folder.id;

        // This is the highest possible priority: we want to ensure that all the
        // event got here are treated before any other tasks.
        const priority = folder.primary ? 99999 : 99998;

        for (const event of results.value) {
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
