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

import { numericUidFromMessageId } from "shared/id_conversions";

import TaskDefiner from "../../../task_infra/task_definer";

import MixinSyncBody from "../../../task_mixins/mix_sync_body";
import MixinImapSyncBody from "../task_mixins/imap_mix_sync_body";

export default TaskDefiner.defineComplexTask([
  MixinSyncBody,
  MixinImapSyncBody,
  {
    prepForMessages(ctx, account /*, messages*/) {
      // For the gmail case we don't have any meaningful prep to do.
      let allMailFolderInfo = account.getFirstFolderWithType("all");
      return Promise.resolve(allMailFolderInfo);
    },

    getFolderAndUidForMesssage(prepped, account, message) {
      return {
        folderInfo: prepped,
        uid: numericUidFromMessageId(message.id),
      };
    },
  },
]);
