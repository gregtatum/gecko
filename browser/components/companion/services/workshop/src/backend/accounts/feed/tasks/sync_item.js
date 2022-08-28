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

import { shallowClone } from "shared/util";

import { prioritizeNewer } from "../../../date_priority_adjuster";

import TaskDefiner from "../../../task_infra/task_definer";

import churnConversation from "../../../churn_drivers/conv_churn_driver";
import { FeedItemChewer } from "../chew_item";

export default TaskDefiner.defineSimpleTask([
  {
    name: "sync_item",

    async plan(ctx, rawTask) {
      let plannedTask = shallowClone(rawTask);

      plannedTask.exclusiveResources = [`conv:${rawTask.convId}`];

      plannedTask.priorityTags = [`view:conv:${rawTask.convId}`];

      // Prioritize syncing the conversation by how new it is.
      if (rawTask.mostRecent) {
        plannedTask.relPriority = prioritizeNewer(rawTask.mostRecent);
      }

      await ctx.finishTask({
        taskState: plannedTask,
      });
    },

    /**
     * Synchronize a RSS item or an Atom entry.
     */
    async execute(ctx, req) {
      const account = await ctx.universe.acquireAccount(ctx, req.accountId);
      const foldersTOC = await ctx.universe.acquireAccountFoldersTOC(
        ctx,
        account.id
      );

      // ## Begin Mutation
      const fromDb = await ctx.beginMutate({
        // It's explicitly possible the conversation doesn't exist yet, in that
        // case we'll get `undefined` back when we do the map lookup.  We do
        // need to be aware of this and make sure we use `newData` in that case.
        conversations: new Map([[req.convId, null]]),
      });

      const oldConvInfo = fromDb.conversations.get(req.convId);
      if (oldConvInfo) {
        // TODO: In the future we should detect changes in the item if we've
        // already synchronized it, but for now we just finish the task
        // without doing anything.
        await ctx.finishTask({});
        return;
      }

      const itemChewer = new FeedItemChewer({
        convId: req.convId,
        item: req.item,
        foldersTOC,
      });

      await itemChewer.chewItem();

      const convInfo = churnConversation(
        req.convId,
        null,
        itemChewer.allMessages
      );

      await ctx.finishTask({
        newData: {
          conversations: [convInfo],
          messages: itemChewer.allMessages,
        },
      });
    },
  },
]);
