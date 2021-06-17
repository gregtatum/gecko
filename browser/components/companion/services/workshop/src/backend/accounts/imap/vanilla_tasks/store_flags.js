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
import MixStoreFlagsMixin from '../../../task_mixins/mix_store_flags';

/**
 * @see MixStoreFlagsMixin
 */
export default TaskDefiner.defineComplexTask([
  MixStoreFlagsMixin,
  {
    name: 'store_flags',
    // We don't care about the fetch return, so don't bother.
    imapDataName: 'FLAGS.SILENT',

    async execute(ctx, persistentState, memoryState, marker) {
      let { umidChanges } = persistentState;

      let changes = umidChanges.get(marker.umid);

      let account = await ctx.universe.acquireAccount(ctx, marker.accountId);

      // -- Read the umidLocation
      let fromDb = await ctx.beginMutate({
        umidLocations: new Map([[marker.umid, null]])
      });

      let [ folderId, uid ] = fromDb.umidLocations.get(marker.umid);
      let folderInfo = account.getFolderById(folderId);

      // -- Issue the manipulations to the server
      if (changes.add && changes.add.length) {
        await account.pimap.store(
          ctx,
          folderInfo,
          [uid],
          '+' + this.imapDataName,
          changes.add,
          { byUid: true });
      }
      if (changes.remove && changes.remove.length) {
        await account.pimap.store(
          ctx,
          folderInfo,
          [uid],
          '-' + this.imapDataName,
          changes.remove,
          { byUid: true });
      }

      // - Success, clean up state.
      umidChanges.delete(marker.umid);

      // - Return / finalize
      await ctx.finishTask({
        complexTaskState: persistentState
      });
    }
  }
]);
