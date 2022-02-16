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

import { makeFolderMeta } from "../db/folder_info_rep";

import { shallowClone } from "shared/util";

/**
 * Mix-in for folder list synchronization and ensuring that an account has all
 * the required offline and online folders.  Offline folders are handled during
 * the planning phase, online folders are handled during the online phase.
 *
 * The logic here isn't particularly complex, but how we handle folders has
 * planned changes, so it seems better to avoid duplicated code even if clarity
 * takes a hit for now.
 *
 * Consumers must provide:
 * - this.syncFolders(ctx, account) returning { modifiedFolders, newFolders,
 *   newTasks }.  This method is responsible for generating deltas to the
 *   current set of folders to reflect the current server state.  If there are
 *   missing online folders, this function should provide tasks in newTasks
 *   to create them.
 *
 * Consumers may provide, clobbering the default implementation:
 * - this.essentialOfflineFolders: A list of folder definitions for offline
 *   folders.  Alternately, the next method can be implemented instead, mooting
 *   this.
 * - this.ensureEssentialOfflineFolders(ctx, account) returning {
 *   modifiedFolders, newFolders }.  Note that you can also just clobber
 *   essentialOfflineFolders if you need less/more.  *do not mutate it* because
 *   the rep is shared.
 *
 * In the case of POP3 where the server has no concept of folders, all folders
 * are offline folders and the planning stage is smart enough to realize it
 * should conclude the task after planning.
 *
 * XXX this implementation should probably be moved into the global tasks
 * location.
 */
const MixinSyncFolderList = {
  name: "sync_folder_list",
  args: ["accountId"],

  // XXX these are IMAP-specific; these should stay here in an IMAP sub-mix-in
  // (these work for gmail too), while most everything else wants to go into a
  // global mix-in soup.  see higher level comment.
  essentialOfflineFolders: [
    // The inbox is special; we are creating it so that we have an id for it
    // even before we talk to the server.  This makes life easier for UI
    // logic even in weird account creation setups.  The one trick is that
    // the normalizeFolder function and our online step have to be clever to
    // fix-up this speculative folder to be a real folder.
    {
      type: "inbox",
      // A previous comment indicated the title-case is intentional, although
      // I think our l10n hacks don't care nor does our fixup logic.
      displayName: "Inbox",
      // IMAP wants this to be at INBOX.  And the other account types don't
      // care.
      path: "INBOX",
      // The IMAP inbox is an online folder that must exist by definition.
      serverPath: "INBOX",
    },
    {
      type: "outbox",
      displayName: "outbox",
    },
    {
      type: "localdrafts",
      displayName: "localdrafts",
    },
  ],

  ensureEssentialOfflineFolders(ctx, account) {
    let foldersTOC = account.foldersTOC;
    let newFolders = [];

    for (let desired of this.essentialOfflineFolders) {
      if (foldersTOC.getCanonicalFolderByType(desired.type) === null) {
        newFolders.push(
          makeFolderMeta({
            id: foldersTOC.issueFolderId(),
            serverId: null,
            name: desired.displayName,
            type: desired.type,
            path: desired.path || desired.displayName,
            serverPath: desired.serverPath || null,
            parentId: null,
            depth: 0,
            lastSyncedAt: 0,
          })
        );
      }
    }

    return Promise.resolve({
      newFolders,
    });
  },

  getResources(ctx, rawTask) {
    return undefined;
  },

  /**
   * Ensure offline folders.
   */
  async plan(ctx, rawTask) {
    let decoratedTask = shallowClone(rawTask);

    decoratedTask.resources = this.getResources(ctx, rawTask);
    decoratedTask.exclusiveResources = [
      // Nothing else that touches folder info is allowed in here.
      `folderInfo:${rawTask.accountId}`,
    ];
    decoratedTask.priorityTags = ["view:folders"];

    let account = await ctx.universe.acquireAccount(ctx, rawTask.accountId);

    let {
      newFolders,
      modifiedFolders,
    } = await this.ensureEssentialOfflineFolders(ctx, account);

    await ctx.finishTask({
      mutations: {
        folders: modifiedFolders,
      },
      newData: {
        folders: newFolders,
      },
      taskState: decoratedTask,
    });
  },

  async execute(ctx, planned) {
    let account = await ctx.universe.acquireAccount(ctx, planned.accountId);

    let {
      modifiedFolders,
      newFolders,
      newTasks,
      modifiedSyncStates,
      accountProblems,
    } = await this.syncFolders(ctx, account);

    const deletedFolderIds = new Map();
    for (const [folderId, value] of modifiedFolders) {
      if (!value) {
        deletedFolderIds.set(folderId, null);
      }
    }

    let deletedMessages;
    if (deletedFolderIds.size !== 0) {
      await ctx.read({ messageKeysByFolder: deletedFolderIds });
      deletedMessages = [...deletedFolderIds.values()].flat();
    }

    // XXX migrate ensureEssentialOnlineFolders to be something the actual
    // instance provides and that we convert into a list of create_folder tasks.
    // (Which implies that mailuniverse should be using task_recipe helpers or
    // something like that?  We should probably ponder the more extreme folder
    // hierarchy situations we could enable like archive-by-month/etc. to help
    // drive the structure.)
    //
    // account.ensureEssentialOnlineFolders();

    await ctx.finishTask({
      mutations: {
        folders: modifiedFolders,
        deletedFolderMessages: deletedMessages,
        syncStates: modifiedSyncStates,
      },
      newData: {
        folders: newFolders,
        tasks: newTasks,
      },
      // all done!
      taskState: null,
      atomicClobbers: {
        account: accountProblems,
      },
    });
  },
};

export default MixinSyncFolderList;
