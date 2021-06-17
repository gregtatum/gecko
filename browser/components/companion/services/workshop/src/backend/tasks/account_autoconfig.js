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

import TaskDefiner from "../task_infra/task_definer";

import autoconfigLookup from "../autoconfig/autoconfig_lookup";

/**
 * This is a thin shim around autoconfigLookup to run it under the task
 * infrastructure.
 *
 * Please see the MailAPI docs on `learnAboutAccount` for more information.
 */
export default TaskDefiner.defineSimpleTask([
  {
    name: "account_autoconfig",

    exclusiveResources() {
      return [];
    },

    priorityTags() {
      return [];
    },

    async execute(ctx, planned) {
      // Run autoconfig.
      let result = await autoconfigLookup(planned.userDetails);
      // Formally complete the task.
      await ctx.finishTask({});
      // Return the autoconfig result.
      return ctx.returnValue(result);
    },
  },
]);
