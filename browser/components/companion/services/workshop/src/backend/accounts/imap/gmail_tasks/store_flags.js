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

import TaskDefiner from "../../../task_infra/task_definer";

import MixinStore from "./mix_store";

export default TaskDefiner.defineComplexTask([
  MixinStore,
  {
    name: "store_flags",
    attrName: "flags",
    // We don't care about the fetch return, so don't bother.
    imapDataName: "FLAGS.SILENT",

    prepNormalizationLogic(/*ctx, accountId*/) {
      return Promise.resolve(null);
    },

    normalizeLocalToServer(ignored, flags) {
      return flags;
    },
  },
]);
