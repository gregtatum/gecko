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

import MixinSyncFolderList from "../../../task_mixins/mix_sync_folder_list";

/**
 * Sync the folder list for an ActiveSync account.  We leverage IMAP's mix-in
 * for the infrastructure (that wants to move someplace less IMAPpy.)
 */
export default TaskDefiner.defineSimpleTask([
  MixinSyncFolderList,
  {
    essentialOfflineFolders: [
      {
        type: "inbox",
        displayName: "Inbox",
      },
      // Eventually we presumably could support modifications, so just leave
      // this around so nothing freaks out.
      {
        type: "outbox",
        displayName: "outbox",
      },
      // And this goes hand-in-hand with that.
      {
        type: "localdrafts",
        displayName: "localdrafts",
      },
    ],

    /**
     * There really isn't anything for us to do at this time.
     */
    async syncFolders(/*ctx, account*/) {
      return {
        newFolders: undefined,
        newTasks: undefined,
        modifiedFolders: undefined,
        modifiedSyncStates: undefined,
      };
    },
  },
]);
