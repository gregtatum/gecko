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
import { shallowClone } from "shared/util";

/**
 * Wait for the task queue to empty.
 *
 * When testing, it can sometimes be useful to wait for the task queue to empty
 * to have a higher likelyhood of whatever you're trying to test to have
 * completed before proceeding.
 */
export default TaskDefiner.defineSimpleTask([
  {
    name: "TEST_queueEmptied",

    helped_plan(ctx, rawTask) {
      // - Plan!
      const plannedTask = shallowClone(rawTask);
      plannedTask.relPriority = -99999;

      return {
        taskState: plannedTask,
      };
    },

    async execute(ctx, planned) {
      await ctx.finishTask({});
    },
  },
]);
