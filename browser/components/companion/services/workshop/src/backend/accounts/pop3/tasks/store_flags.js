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

import MixinStoreFlags from "../../../task_mixins/mix_store_flags";

/**
 * We use the vanilla IMAP store flags implementation without any execute stage
 * since everything is just local.  We just have the mix-in conditionalize its
 * state accumulation on execute being non-null since the code doesn't get too
 * messy.
 *
 * @see MixStoreFlagsMixin
 */
export default TaskDefiner.defineComplexTask([
  MixinStoreFlags,
  {
    name: "store_flags",

    execute: null,
  },
]);
