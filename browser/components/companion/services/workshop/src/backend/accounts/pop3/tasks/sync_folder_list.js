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

import MixinSyncFolderList from '../../../task_mixins/mix_sync_folder_list';

/**
 * Create the POP3 offline-only folders.
 */
export default TaskDefiner.defineSimpleTask([
  MixinSyncFolderList,
  {
    essentialOfflineFolders: [
      // Note that versus IMAP, our inbox is offline.
      {
        type: 'inbox',
        displayName: 'Inbox'
      },
      {
        type: 'outbox',
        displayName: 'outbox'
      },
      {
        type: 'localdrafts',
        displayName: 'localdrafts'
      },
      // pop3-specific that would normally be online folders
      {
        type: 'trash',
        displayName: 'trash'
      },
      {
        type: 'sent',
        displayName: 'sent'
      }
    ],

    // We have no online component.
    execute: null
  }
]);
