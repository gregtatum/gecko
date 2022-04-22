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
import { makeDaysAgo, NOW } from "shared/date";

/**
 * Clean up the account in removing too old messages
 */

const MixinAccountCleanup = {
  name: "account_cleanup",
  args: ["accountId"],

  plan(ctx, rawTask) {
    // - Plan!
    let plannedTask = shallowClone(rawTask);
    const { accountId } = rawTask;
    plannedTask.resources = [`happy!${accountId}`];
    plannedTask.priorityTags = [`view:account:${accountId}`];

    // No rush... it's just clean-up stuff.
    plannedTask.relPriority = -99998;

    return ctx.finishTask({
      taskState: plannedTask,
    });
  },

  async execute(ctx, req) {
    const messagesByAccount = new Map([[req.accountId, null]]);
    await ctx.read({
      messagesByAccount,
    });
    const messages = messagesByAccount.get(req.accountId);

    const syncDate = NOW();
    logic(ctx, "accountCleanup", { syncDate });

    const minDate = makeDaysAgo(-this.daysAgo);
    const tooOldMessages = [];
    for (const message of messages) {
      if (message.endDate < minDate) {
        tooOldMessages.push(message);
      }
    }

    const additionalDeletions = this.getAdditionalDeletions(tooOldMessages);

    logic(ctx, "accountCleanupEnd", {
      deletedMessagesNumber: tooOldMessages.length,
    });

    await ctx.finishTask({
      mutations: {
        deletedMessages: tooOldMessages,
        ...additionalDeletions,
      },
    });
  },
};

export default MixinAccountCleanup;
