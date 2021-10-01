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

import TaskDefiner from "../../../task_infra/task_definer";

import churnConversation from "../../../churn_drivers/conv_churn_driver";
import { GapiCalEventChewer } from "../chew_gapi_cal_events";

export default TaskDefiner.defineSimpleTask([
  {
    name: "cal_sync_conv",

    async plan(ctx, rawTask) {
      let plannedTask = shallowClone(rawTask);

      plannedTask.exclusiveResources = [`conv:${rawTask.convId}`];

      plannedTask.priorityTags = [`view:conv:${rawTask.convId}`];

      // For now there's no reason to prioritize this sync task based on its own
      // date or `calUpdatedTS`, noting that we potentially could have
      // correctness problems if we prioritized higher `calUpdatedTS` values as
      // that would be intentionally making us consume newer dater before older
      // data.  However, we should likely address that by just changing this to
      // a complex task that merges eventMaps with higher `calUpdatedTS` values
      // clobbering older values.

      await ctx.finishTask({
        taskState: plannedTask,
      });
    },

    /**
     * Synchronize a calendar UID event bundle, where all the event data is
     * actually already known and provided as part of the task definition.
     */
    async execute(ctx, req) {
      let account = await ctx.universe.acquireAccount(ctx, req.accountId);
      let foldersTOC = await ctx.universe.acquireAccountFoldersTOC(
        ctx,
        account.id
      );

      // ## Begin Mutation
      let fromDb = await ctx.beginMutate({
        // It's explicitly possible the conversation doesn't exist yet, in that
        // case we'll get `undefined` back when we do the map lookup.  We do
        // need to be aware of this and make sure we use `newData` in that case.
        conversations: new Map([[req.convId, null]]),
        messagesByConversation: new Map([[req.convId, null]]),
      });

      const oldEvents = fromDb.messagesByConversation.get(req.convId);
      const oldConvInfo = fromDb.conversations.get(req.convId);

      const eventChewer = new GapiCalEventChewer({
        ctx,
        convId: req.convId,
        folderId: req.folderId,
        rangeOldestTS: req.rangeOldestTS,
        rangeNewestTS: req.rangeNewestTS,
        eventMap: req.eventMap,
        oldConvInfo,
        oldEvents,
        foldersTOC,
      });
      await eventChewer.chewEventBundle();
      logic(ctx, "debuggy", {
        eventMap: eventChewer.eventMap,
        allEvents: eventChewer.allEvents,
      });

      let convInfo;
      // It's possible we don't want a conversation (anymore) if there are no
      // events.
      if (eventChewer.allEvents.length) {
        convInfo = churnConversation(
          req.convId,
          oldConvInfo,
          eventChewer.allEvents,
          "event"
        );
      } else {
        convInfo = null;
      }

      // ## Finish the task
      // Properly mark the conversation as new or modified based on whether we
      // had an old conversation.
      let modifiedConversations, newConversations;
      if (oldConvInfo) {
        modifiedConversations = new Map([[req.convId, convInfo]]);
      } else if (convInfo) {
        newConversations = [convInfo];
      }

      await ctx.finishTask({
        mutations: {
          conversations: modifiedConversations,
          messages: eventChewer.modifiedEventMap,
        },
        newData: {
          conversations: newConversations,
          messages: eventChewer.newEvents,
        },
      });
    },
  },
]);
