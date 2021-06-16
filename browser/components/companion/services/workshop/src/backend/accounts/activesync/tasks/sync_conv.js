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

import TaskDefiner from '../../../task_infra/task_definer';

import { applyChanges } from '../../../delta_algebra';

import MixinSyncConv from '../../../task_mixins/mix_sync_conv';

/**
 * Planning-only task that applies modifications to a conversation based on
 * other sync logic.
 */
export default TaskDefiner.defineSimpleTask([
  MixinSyncConv,
  {
    name: 'sync_conv',

    applyChanges: function(message, flagChanges) {
      applyChanges(message.flags, flagChanges);
    },
  }
]);
