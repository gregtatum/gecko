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
import { EVENT_OUTSIDE_SYNC_RANGE, NOW, makeDaysAgo } from "shared/date";

import TaskDefiner from "../../../task_infra/task_definer";

import { syncNormalOverlay } from "../../../task_helpers/sync_overlay_helpers";
import GapiCalFolderSyncStateHelper from "../cal_folder_sync_state_helper";
import { prepareChangeForProblems } from "../../../utils/tools";
import {
  convIdComponentFromMessageId,
  isPrimaryFolder,
  makeUmidWithinFolder,
  messageIdComponentFromMessageId,
} from "shared/id_conversions";

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
        result: ctx.trackMeInTaskGroup(`sync_refresh:${rawTask.folderId}`),
      });
    },

    helped_plan(ctx, rawTask) {
      // - Plan!
      const plannedTask = shallowClone(rawTask);
      const { accountId } = rawTask;
      plannedTask.resources = [
        "online",
        `credentials!${accountId}`,
        `happy!${accountId}`,
        `permissions!${accountId}`,
        `queries!${accountId}`,
      ];
      plannedTask.priorityTags = [`view:account:${rawTask.accountId}`];

      // Give a higher priority to primary calendar
      plannedTask.relPriority = isPrimaryFolder(rawTask.folderId) ? 1000 : 0;

      // Create a task group that follows this task and all its offspring.  This
      // will define the lifetime of our overlay as well.
      const groupPromise = ctx.trackMeInTaskGroup(
        `sync_refresh:${rawTask.folderId}`
      );
      return {
        taskState: plannedTask,
        remainInProgressUntil: groupPromise,
        result: groupPromise,
      };
    },

    async helped_execute(ctx, req) {
      const account = await ctx.universe.acquireAccount(ctx, req.accountId);
      const folderInfo = account.foldersTOC.foldersById.get(req.folderId);
      if (!folderInfo) {
        return {};
      }

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
      if (!ctx.universe.isTestingMode() && syncState.syncDate >= syncDate) {
        // We're using a fake time so we must sync around it.
        syncState.syncToken = null;
      }

      logic(ctx, "syncStart", { syncDate });

      const calendarId = folderInfo.serverId;
      const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;

      let params;
      if (syncState.syncToken) {
        params = {
          // syncToken doesn't take into account the singleEvents passed in the
          // original query, so we must pass it again.
          // See issue https://mozilla-hub.atlassian.net/browse/MR2-1689.
          singleEvents: true,
          syncToken: syncState.syncToken,
        };
      } else {
        params = {
          singleEvents: true,
          timeMin: syncState.timeMinDateStr,
          timeMax: syncState.timeMaxDateStr,
        };
      }

      // TODO: Factor this out into an engine constant and come up with a
      // rationale.  Right now this is an arbitrary cut-off intended to capture
      // when a meeting crosses from being a meeting to a large-group
      // presentation.
      params.maxAttendees = 50;

      const apiCallArguments = [
        endpoint,
        params,
        "items",
        result =>
          result.nextPageToken
            ? {
                params: { pageToken: result.nextPageToken },
              }
            : null,
      ];

      const changes = {
        mutations: {
          syncStates: new Map([[req.folderId, syncState.rawSyncState]]),
        },
        newData: {
          tasks: syncState.tasksToSchedule,
        },
        atomicClobbers: {
          folders: new Map(),
        },
      };

      let results;

      const handleError = ({ e, error }) => {
        // TODO: Improved error handling; MR2-1326 should be the core of this.
        //
        // So far we've seen this with:
        // { code: 403, errors: [ { message: "Insufficient Permission",
        //   domain: "global", reason: "insufficientPermissions" }],
        //   status: "PERMISSION_DENIED" }.
        //
        // That's a permanent failure on a single calendar; it's not clear that
        // this should generate a permanent problem for the account.
        logic(ctx, "syncError", { error: e?.message || error });

        changes.atomicClobbers.folders.set(req.folderId, {
          lastAttemptedSyncAt: syncDate,
          // XXX this should theoretically be an atomicDelta, not a clobber...
          // That said, this is harmless since we have exclusive ownership over
          // this field, as opposed to unread counts for folders which can have
          // multiple incidental writers, etc.
          failedSyncsSinceLastSuccessfulSync:
            folderInfo.failedSyncsSinceLastSuccessfulSync + 1,
        });

        if (e?.problem) {
          changes.atomicClobbers.accounts = prepareChangeForProblems(
            account,
            e.problem
          );
        }

        // In case of errors just reset the token and etag in order to have
        // a full sync in the next refresh.
        syncState.syncToken = null;
        syncState.etag = null;
      };

      try {
        results = await account.client.pagedApiGetCall(...apiCallArguments);
      } catch (e) {
        // Critical error.
        handleError({ e });
        return changes;
      }

      if (!results) {
        handleError({ error: "No data" });
        return changes;
      }

      if (results.error?.code === 410) {
        // 410: Gone
        // Sync token is no longer valid, a full sync is required.
        // https://developers.google.com/calendar/api/guides/errors#410_gone
        apiCallArguments[1] = {
          singleEvents: true,
          timeMin: syncState.timeMinDateStr,
          timeMax: syncState.timeMaxDateStr,
        };

        try {
          results = await account.client.pagedApiGetCall(...apiCallArguments);
        } catch (e) {
          // Critical error.
          handleError({ e });
          return changes;
        }
      }

      if (!results || results.error) {
        handleError({ error: results?.error || "No data" });
        return changes;
      }

      const umidNames = new Map();
      const cancelledEvents = new Map();

      // Attach some metadata to the event in order to avoid to have to recompute
      // them but without adding them to the object directly (to avoid any name
      // conflicts): hence a WeakMap.
      const metadatas = new WeakMap();

      const todayTS = makeDaysAgo(0);
      const tomorrowTS = makeDaysAgo(-1);

      const recurringIds = new Set();

      for (const event of results.items) {
        let priority = 0;
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
          // Give a higher priority to events which are happening today.
          priority = startDate <= tomorrowTS && todayTS <= endDate ? 1001 : 0;
        }

        if (event.visibility === "private" && !event.attendees) {
          // From documentation:
          //   The event is private and only event attendees may view event
          //   details.
          // So if attendees is empty there are no chance to have something
          // interesting.
          continue;
        }

        const uniqueId = makeUmidWithinFolder(req.folderId, event.id);
        umidNames.set(uniqueId, null);
        let cancelled = false;
        if (event.recurringEventId) {
          recurringIds.add(event.recurringEventId);
        }
        if (event.status === "cancelled" && !event.recurringEventId) {
          // When some instance of a recurring event are cancelled it's possible
          // to not always have the recurringEventId which was used to build
          // the messageId of the event.
          // So in order to have everything at the right place, we need to
          // figure out the recurringEventId (if any).
          cancelledEvents.set(uniqueId, event);
          cancelled = true;
        }

        metadatas.set(event, { uniqueId, cancelled, priority });
      }

      await ctx.read({ umidNames });

      for (const event of results.items) {
        // We check that the recurringEventId didn't change.
        // When an instance and its successors of a recurring event are changed
        // then a new recurring event is created but the instances have the same
        // ids.
        // And therefore we need to clean up the previous database state. We do
        // this by creating a synthetic cancellation of the previous version of
        // the event which will be processed by GapiCalEventChewer in the
        // "cal_sync_conv" task.
        const metadata = metadatas.get(event);
        if (!metadata) {
          continue;
        }

        const { uniqueId, cancelled, priority } = metadata;
        if (cancelled) {
          continue;
        }

        syncState.ingestEvent(event, priority);

        const eventId = umidNames.get(uniqueId);
        if (!eventId) {
          continue;
        }
        const prevRecurringId = convIdComponentFromMessageId(eventId);
        if (
          event.recurringEventId &&
          prevRecurringId !== event.recurringEventId
        ) {
          const messageId = messageIdComponentFromMessageId(eventId);
          syncState.ingestEvent({
            recurringEventId: prevRecurringId,
            status: "cancelled",
            id: messageId,
          });
        }
      }

      for (const [uniqueId, event] of cancelledEvents) {
        const eventId = umidNames.get(uniqueId);
        if (!eventId) {
          // Some events which shouldn't be there are there !
          // So in case we didn't add them to the db, just skip.
          continue;
        }
        // convId is built with either recurringEventId or id (it depends
        // if the event is recurring or not).
        const convId = convIdComponentFromMessageId(eventId);
        const messageId = messageIdComponentFromMessageId(eventId);
        if (convId !== messageId) {
          // We're cheating in adding the recurringEventId and everybody
          // is happy.
          event.recurringEventId = convId;
          recurringIds.add(convId);
        }
        syncState.ingestEvent(event);
      }

      let recurringEvents;
      try {
        // We must get informations about the root event of a recurring one in
        // order to apply correctly changes to the instances.
        // For example when the start time changed then all the instances have
        // a different id (because the id is built in using a uuid + starting
        // date), consequently in such a case we must remove all the previous
        // instances.
        recurringEvents = await Promise.all(
          [...recurringIds].map(recurringId =>
            account.client.apiGetCall(
              `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${recurringId}`,
              null
            )
          )
        );
      } catch (e) {
        // Critical Error.
        handleError({ e });
        return changes;
      }

      for (const event of recurringEvents) {
        if (!event || event.error) {
          handleError({ error: event?.error | "No data" });
          return changes;
        }

        syncState.ingestEvent(event);
      }

      // Update sync state before processing the batch; things like the
      // calUpdatedTS need to be available.
      syncState.syncDate = syncDate;
      syncState.syncToken = results.nextSyncToken;
      syncState.etag = results.etag;
      syncState.updatedTime = results.updatedTime;

      syncState.processEvents();

      if (account.problems) {
        changes.atomicClobbers.accounts = prepareChangeForProblems(
          account,
          null
        );
      }

      changes.atomicClobbers.folders.set(req.folderId, {
        lastSuccessfulSyncAt: syncDate,
        lastAttemptedSyncAt: syncDate,
        failedSyncsSinceLastSuccessfulSync: 0,
      });

      logic(ctx, "syncEnd", {});

      return changes;
    },
  },
]);
