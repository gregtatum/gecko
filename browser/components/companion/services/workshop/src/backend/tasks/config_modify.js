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

/**
 * Manipulate global configuration settings.
 */
export default TaskDefiner.defineSimpleTask([
  {
    name: "config_modify",

    async plan(ctx, rawTask) {
      // This could also be a simple dictionary if we're sure we won't have to
      // do complex hierarchical manipulations.
      const globalClobbers = new Map();

      for (let key in rawTask.mods) {
        const val = rawTask.mods[key];

        switch (key) {
          case "debugLogging":
            globalClobbers.set(["debugLogging"], val);
            logic.realtimeLogEverything = val === "realtime";
            break;

          default:
            logic(ctx, "badModifyConfigKey", { key });
            break;
        }
      }

      // This will:
      // - Apply the above mutations atomically to the conf.
      // - Generate a "config" event on the DB which `_bindStandardBroadcasts`
      //   on the universe is listening for and will re-broadcast to all
      //   clients.
      await ctx.finishTask({
        atomicClobbers: {
          config: globalClobbers,
        },
      });
    },
  },
]);
