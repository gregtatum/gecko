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

/**
 * Account migration via account re-creation during the planning phase.
 *
 * This covers database schema changes where the account definition has not
 * changed (but other things have), so we can get away with just re-saving the
 * account definition to disk.
 *
 * This implementation assumes that the MailUniverse.init method is continuing
 * to propagate the nextAccountNum from the old config.
 */
export default TaskDefiner.defineSimpleTask([
  {
    name: 'account_migrate',

    async plan(ctx, raw) {
      let { accountDef } = raw;

      await ctx.finishTask({
        newData: {
          accounts: [accountDef]
        }
      });
    },

    execute: null
  }
]);
