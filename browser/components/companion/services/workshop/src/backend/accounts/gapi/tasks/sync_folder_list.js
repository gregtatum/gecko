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
import { NOW } from "shared/date";
import TaskDefiner from "../../../task_infra/task_definer";

import MixinSyncFolderList from "../../../task_mixins/mix_sync_folder_list";
import { makeFolderMeta } from "backend/db/folder_info_rep";
import GapiAccountSyncStateHelper from "../account_sync_state_helper";
import { prepareChangeForProblems } from "../../../utils/tools";

/**
 * Sync the folder list for an ActiveSync account.  We leverage IMAP's mix-in
 * for the infrastructure (that wants to move someplace less IMAPpy.)
 */
export default TaskDefiner.defineSimpleTask([
  MixinSyncFolderList,
  {
    essentialOfflineFolders: [
      {
        type: "inbox-summary",
        displayName: "Gmail Summary",
      },
    ],

    getResources(ctx, rawTask) {
      const { accountId } = rawTask;
      return [
        "online",
        `credentials!${accountId}`,
        `happy!${accountId}`,
        `permissions!${accountId}`,
        `queries!${accountId}`,
      ];
    },

    async syncFolders(ctx, account) {
      const fromDb = await ctx.beginMutate({
        syncStates: new Map([[account.id, null]]),
      });

      const rawSyncState = fromDb.syncStates.get(account.id);
      // Note: We don't use this yet, but we will, so it's here.
      const syncState = new GapiAccountSyncStateHelper(
        ctx,
        rawSyncState,
        account.id
      );

      logic(ctx, "syncFolderListStart", { syncDate: NOW() });

      const foldersTOC = account.foldersTOC;

      // ## Calendars
      let results;

      try {
        results = await account.client.pagedApiGetCall(
          "https://www.googleapis.com/calendar/v3/users/me/calendarList",
          // We currently don't pass `syncToken` because we expect this list to be
          // short and the 410 GONE response indicating an expired syncToken means
          // that we do need to be able to resolve any deltas ourselves (unless
          // we're okay with clearing out all existing calendar state).
          {},
          "items",
          result => {}
        );
      } catch (e) {
        // Critical error.
        logic(ctx, "syncError", { error: e.message });
        const accountProblems = prepareChangeForProblems(account, e.problem);
        return { accountProblems };
      }

      if (!results) {
        logic(ctx, "syncError", { error: "No data" });
        return {};
      }

      const newFolders = [];
      const modifiedFolders = new Map();
      // Track observed folders by their serverId so we can infer deletions.
      // Note that when we switch to using the syncToken, this should only be
      // used when the syncToken is declared invalid!
      const observedFolderServerIds = new Set();

      for (const calInfo of results.items) {
        const primary = !!calInfo.primary;
        // Currently we only want to show events from the user's primary calendar.
        // The selection logic is currently less relevant, since there is very
        // little chance that the user will de-select their main calendar. This
        // selection logic has been left in place since there's a good chance we will
        // want to add support secondary calendars.
        let wantFolder = primary && calInfo.selected;

        let calFolder = foldersTOC.items.find(f => f.serverId === calInfo.id);
        // We don't want to synchronize unselected folders, so we can skip them,
        // but we do want to delete the folder if we had previously created it.
        if (!wantFolder) {
          if (calFolder) {
            modifiedFolders.set(calFolder.id, null);
          }
          continue;
        }
        // (we want the folder)

        // We're only setting the folder as observed since we want it; this may
        // result in a redundant deletion between the above call to
        // modifiedFolders.set and our deletion inference pass after this loop.
        observedFolderServerIds.add(calInfo.id);

        let desiredCalendarInfo = {
          timeZone: calInfo.timeZone,
          color: calInfo.backgroundColor || null,
        };

        if (!calFolder) {
          calFolder = makeFolderMeta({
            id: foldersTOC.issueFolderId(primary),
            serverId: calInfo.id,
            name: calInfo.summary,
            description: calInfo.description,
            type: "calendar",
            // So far our server-based calendars don't seem to support a concept
            // of a hierarchy.
            path: null,
            serverPath: null,
            parentId: null,
            delim: null,
            depth: 0,
            syncGranularity: "folder",
            calendarInfo: desiredCalendarInfo,
            primary,
          });
          newFolders.push(calFolder);
        } else {
          // Apply potentially relevant changes.
          let modified = false;

          // For fundamental properties, we check manually.
          if (calFolder.name !== calInfo.summary) {
            calFolder.name = calInfo.summary;
            modified = true;
          }
          if (calFolder.description !== calInfo.description) {
            calFolder.description = calInfo.description;
            modified = true;
          }

          // For the desiredCalendarInfo, we can just do a direct delta check.
          for (const [dkey, dvalue] of Object.entries(desiredCalendarInfo)) {
            if (calFolder.calendarInfo[dkey] !== dvalue) {
              calFolder.calendarInfo[dkey] = dvalue;
              modified = true;
            }
          }

          // Update the database if appropriate.
          if (modified) {
            modifiedFolders.set(calFolder.id, calFolder);
          }
        }
      }

      logic(ctx, "syncFolderListEnd", {});

      // Infer deletions by checking for folders we know about but that aren't
      // in `observedFolderServerIds`.
      for (const folderInfo of foldersTOC.items.filter(
        x => x.type === "calendar"
      )) {
        if (!observedFolderServerIds.has(folderInfo.serverId)) {
          // We have a folder for which there isn't a current serverId, so it
          // should be deleted.  (Note that if the `wantFolder` transitioned to
          // false above, this may be a redundant/idempotent setting.)
          modifiedFolders.set(folderInfo.id, null);
        }
      }

      const accountProblems = account.problems
        ? prepareChangeForProblems(account, null)
        : null;

      return {
        newFolders,
        modifiedFolders,
        modifiedSyncStates: new Map([[account.id, syncState.rawSyncState]]),
        accountProblems,
      };
    },
  },
]);
