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

import TaskDefiner from "../../../task_infra/task_definer";

import MixinSyncFolderList from "../../../task_mixins/mix_sync_folder_list";
import { makeFolderMeta } from "backend/db/folder_info_rep";
import MapiAccountSyncStateHelper from "../account_sync_state_helper";
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
        displayName: "Outlook Summary",
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
      const syncState = new MapiAccountSyncStateHelper(
        ctx,
        rawSyncState,
        account.id
      );

      const foldersTOC = account.foldersTOC;

      // ## Calendars
      let results;

      try {
        results = await account.client.pagedApiGetCall(
          "https://graph.microsoft.com/v1.0/me/calendars",
          {},
          "value",
          result => {}
        );
      } catch (e) {
        // Critical error.
        logic(ctx, "syncError", { error: e.message });
        const accountProblems = prepareChangeForProblems(account, e.problem);
        return { accountProblems };
      }

      if (!results || results.error) {
        logic(ctx, "syncError", { error: results?.error || "No data" });
        return {};
      }

      const newFolders = [];
      const modifiedFolders = new Map();
      // Track observed folders by their serverId so we can infer deletions.
      // Note that when we switch to using the syncToken, this should only be
      // used when the syncToken is declared invalid!
      const observedFolderServerIds = new Set();

      for (const calInfo of results.value) {
        // For now we only want folders that the user owns, so we skip
        // any folders associated with shared calendars, etc.
        if (calInfo.owner.address !== account.accountDef.name) {
          continue;
        }

        // We're only setting the folder as observed since we want it; this may
        // result in a redundant deletion between the above call to
        // modifiedFolders.set and our deletion inference pass after this loop.
        observedFolderServerIds.add(calInfo.id);

        const desiredCalendarInfo = {
          color: calInfo.hexColor || null,
        };

        let calFolder = foldersTOC.items.find(f => f.serverId === calInfo.id);
        if (!calFolder) {
          const name = calInfo.name || "unknown";
          calFolder = makeFolderMeta({
            id: foldersTOC.issueFolderId(),
            serverId: calInfo.id,
            name,
            description: name,
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
            primary: calInfo.isDefaultCalendar,
          });
          newFolders.push(calFolder);
        } else {
          // Apply potentially relevant changes.
          let modified = false;

          // For fundamental properties, we check manually.
          if (calFolder.name !== calInfo.name) {
            calFolder.name = calFolder.description = calInfo.name;
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
