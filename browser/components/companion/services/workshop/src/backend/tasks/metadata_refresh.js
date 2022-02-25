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
import TaskDefiner from "../task_infra/task_definer";
import * as $urlchew from "../bodies/urlchew";
import { shallowClone } from "shared/util";
import { prepareChangeForProblems } from "../utils/tools";

/**
 * This task is scheduled when refreshMetadata is called on a
 * VirtualConversationTOC. This automatically happens when the
 * VirtualConversationTOC is explicitly refreshed or when a new item is added to
 * the TOC (such as when it enters the "now" time range or the TOC is first
 * populated) so that metadata is always updated in a timely fashion as it
 * becomes visible to the user. It's also possible to call refreshMetadata on
 * the universe and refresh the metadata for all extant VirtualConversationTOC
 * instances; this will be automatically invoked if refreshAllMessages is called
 * as well.
 */
export default TaskDefiner.defineAtMostOnceTask([
  {
    name: "sync_refresh_metadata",
    binByArg: "baseAccountId",

    helped_update_marker(ctx, marker, req) {
      // For performance reasons, we get all the metadata in an async
      // way.
      // When new events are added to the in the virtual conversation TOC some
      // refreshMetadata are triggered. But we don't want to have a new task
      // each time: it'll almost induce we get the metadata sequentially.
      // So in order to have enough data in the task we just update it.
      marker.itemsById.set(req.convId, req.items);
    },

    helped_plan(ctx, rawTask) {
      // - Plan!
      const plannedTask = shallowClone(rawTask);
      const { baseAccountId, accountIds, convId, items } = rawTask;

      plannedTask.resources = ["online"];
      for (const accountId of accountIds) {
        plannedTask.resources.push(
          `credentials!${accountId}`,
          `happy!${accountId}`,
          `permissions!${accountId}`,
          `queries!${accountId}`
        );
      }

      plannedTask.priorityTags = [`view:account:${baseAccountId}`];
      plannedTask.relPriority = 99997;

      plannedTask.itemsById = new Map([[convId, items]]);
      delete plannedTask.convId;
      delete plannedTask.items;

      return {
        taskState: plannedTask,
      };
    },

    async helped_execute(ctx, req) {
      logic(ctx, "syncRefreshMetadata", {});

      const { accountIds, itemsById } = req;
      const accounts = await Promise.all(
        accountIds.map(id => ctx.universe.acquireAccount(ctx, id))
      );
      const clients = new Map(
        accounts.map(account => [account.constructor.type, account.client])
      );
      const docTitleCache = new Map();

      // ## Begin Mutation
      let messages = new Map();
      for (const items of itemsById.values()) {
        for (const [id, message] of items) {
          messages.set([id, message.date], null);
        }
      }
      const fromDb = await ctx.beginMutate({ messages });
      messages = fromDb.messages;

      const promises = [];
      const newMessages = new Map();
      const changes = {
        mutations: {
          messages: newMessages,
        },
      };

      for (const [id, message] of messages) {
        for (const link of message.links) {
          promises.push(
            $urlchew
              .getDocumentTitle(link.url, clients, docTitleCache)
              .then(data => {
                if (!data) {
                  return;
                }
                const { title, type } = data;
                const oldInfo = Object.assign({}, link.docInfo || {});

                let hasChanged = false;
                if (type !== oldInfo.type) {
                  oldInfo.type = type;
                  hasChanged = true;
                }
                if (
                  (title !== null && title !== oldInfo.title) ||
                  (title === null && oldInfo.title === undefined)
                ) {
                  oldInfo.title = title;
                  hasChanged = true;
                }
                if (hasChanged) {
                  link.docInfo = oldInfo;
                  newMessages.set(id, message);
                }
              })
          );
        }
      }

      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === "fulfilled") {
          continue;
        }
        const ex = result.reason;
        logic(ctx, "syncError", { error: ex.message });
        if (ex.account && ex.problem) {
          changes.atomicClobbers = {
            accounts: prepareChangeForProblems(ex.account, ex.problem),
          };
        }
      }

      logic(ctx, "syncRefreshMetadataEnd", {});

      return changes;
    },
  },
]);
