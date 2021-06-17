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

/**
 * These are the tasks for gmail accounts.
 */
import VanillaSyncFolderList from "./vanilla_tasks/sync_folder_list";

import GmailSyncGrow from "./gmail_tasks/sync_grow";
import GmailSyncRefresh from "./gmail_tasks/sync_refresh";
import GmailSyncConv from "./gmail_tasks/sync_conv";
import GmailSyncBody from "./gmail_tasks/sync_body";

import GmailStoreFlags from "./gmail_tasks/store_flags";
import GmailStoreLabels from "./gmail_tasks/store_labels";

import GmailDownload from "./gmail_tasks/download";

import CommonDraftSave from "../../tasks/draft_save";
import CommonDraftAttach from "../../tasks/draft_attach";
import CommonDraftDetach from "../../tasks/draft_detach";
import CommonDraftDelete from "../../tasks/draft_delete";
import GmailOutboxSend from "./gmail_tasks/outbox_send";

import CommonAccountModify from "../../tasks/account_modify";
import CommonIdentityModify from "../../tasks/identity_modify";

import CommonNewTracking from "../../tasks/new_tracking";

export default [
  VanillaSyncFolderList,

  GmailSyncGrow,
  GmailSyncRefresh,
  GmailSyncConv,
  GmailSyncBody,

  GmailStoreFlags,
  GmailStoreLabels,

  GmailDownload,

  CommonDraftSave,
  CommonDraftAttach,
  CommonDraftDetach,
  CommonDraftDelete,
  GmailOutboxSend,

  CommonAccountModify,
  CommonIdentityModify,

  CommonNewTracking,
];
