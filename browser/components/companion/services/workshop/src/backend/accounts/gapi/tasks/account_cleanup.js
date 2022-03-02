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

import { getUmidWithinFolderForMessageId } from "shared/id_conversions";

import TaskDefiner from "../../../task_infra/task_definer";
import MixinAccountCleanup from "../../../task_mixins/mix_account_cleanup";
import { engineBackEndFacts } from "../../../engine_glue";

export default TaskDefiner.defineSimpleTask([
  MixinAccountCleanup,
  {
    get daysAgo() {
      const [min] = engineBackEndFacts.get("gapi").syncRangeInDays;
      return min;
    },

    getAdditionalDeletions(messages) {
      const umidNames = new Map();
      for (const { id } of messages) {
        const uniqueId = getUmidWithinFolderForMessageId(id);
        umidNames.set(uniqueId, null);
      }
      return { umidNames };
    },
  },
]);
