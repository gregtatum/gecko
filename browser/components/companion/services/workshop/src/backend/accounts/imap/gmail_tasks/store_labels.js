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

import GmailLabelMapper from '../gmail/gmail_label_mapper';

import MixinStore from './mix_store';

export default TaskDefiner.defineComplexTask([
  MixinStore,
  {
    name: 'store_labels',
    attrName: 'folderIds',
    // Note that we don't care about the read-back value.  Need to check if
    // this understands and honors a .SILENT suffix. TODO: check suffix.
    imapDataName: 'X-GM-LABELS',

    /**
     * Acquire a GmailLabelMapper for `normalizeLocalToServer`.
     */
    async prepNormalizationLogic(ctx, accountId) {
      let foldersTOC =
        await ctx.universe.acquireAccountFoldersTOC(ctx, accountId);
      return new GmailLabelMapper(ctx, foldersTOC);
    },

    /**
     * Transform FolderId values to GmailLabel values.  Used by the planning
     * stage as it crosses from the "do local things" to "schedule server
     * things" stage of things.
     */
    normalizeLocalToServer(labelMapper, folderIds) {
      // folderIds may be null, in which case we want to pass it through that
      // way.
      if (!folderIds) {
        return folderIds;
      }
      return labelMapper.folderIdsToLabels(folderIds);
    }
  }
]);
