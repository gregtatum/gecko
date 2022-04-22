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

import AccountCreate from "./tasks/account_create";
import AccountDelete from "./tasks/account_delete";
import AccountMigrate from "./tasks/account_migrate";
import ConfigModify from "./tasks/config_modify";
import MetadataRefresh from "./tasks/metadata_refresh";
import NewFlush from "./tasks/new_flush";
import TestQueueEmptied from "./tasks/test_queue_emptied";

/**
 * Global tasks which aren't associated with a specific account type.
 */
export default [
  // - Global
  ConfigModify,

  // - Account management
  AccountCreate,
  AccountDelete,
  AccountMigrate,

  // - Aggregate state stuff
  NewFlush,

  MetadataRefresh,

  // - Testing tasks
  TestQueueEmptied,
];
