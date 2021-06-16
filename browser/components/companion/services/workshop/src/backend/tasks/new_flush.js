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

import TaskDefiner from '../task_infra/task_definer';

import churnAllNewMessages from 'app_logic/new_batch_churn';

/**
 * This task gathers up the new_tracking data from all accounts, feeds it to the
 * new_batch_churn, and sends the result over the wire to the frontend as a
 * broadcast.
 *
 * This task is automatically enqueued for scheduling when the root task group
 * of a task that modifies the newness state completes or when the new_tracking
 * state is explicitly cleared.  This means that this task happens magically
 * and you do not need to schedule it yourself.
 */
export default TaskDefiner.defineAtMostOnceTask([
  {
    name: 'new_flush',
    // This will cause us to use the bin 'only' at all times.
    binByArg: null,

    async helped_plan(ctx/*, rawTask*/) {
      // -- Get the list of all accounts
      // grab the TOC and use getAllItems to get the bridge wire-protocol rep
      // because we expose the account info objects to the app logic and it's
      // arguably safer/simpler for us to provide that rather than the full
      // accountDef.
      const accountsTOC = await ctx.acquireAccountsTOC();
      const accountInfos = accountsTOC.getAllItems();

      // -- For each account, consult the new_tracking task to get the data
      const newSetsWithAccount = [];
      for (let accountInfo of accountInfos) {
        let newByConv = ctx.synchronouslyConsultOtherTask(
          {
            name: 'new_tracking',
            accountId: accountInfo.id
          });
        newSetsWithAccount.push({
          accountInfo,
          newByConv
        });
      }

      // -- Have the app logic churn
      let churned = await churnAllNewMessages(ctx, newSetsWithAccount);

      // -- Send the result over the bridge.
      ctx.broadcastOverBridges('newMessagesUpdate', churned);

      // -- All done
      return {
        taskState: null
      };
    },
  }
]);
