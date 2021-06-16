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

import AccountAutoconfig from './tasks/account_autoconfig';
import AccountCreate from './tasks/account_create';
import AccountDelete from './tasks/account_delete';
import AccountMigrate from './tasks/account_migrate';
import DraftCreate from './tasks/draft_create';
import NewFlush from './tasks/new_flush';

/**
 * Global tasks which aren't associated with a specific account type.
 */
export default [
  // - Account management
  AccountAutoconfig,
  AccountCreate,
  AccountDelete,
  AccountMigrate,

  // - Drafts
  DraftCreate,

  // (All other drafts tasks are per-account even though they use the same
  // global implementations.)

  // - Aggregate state stuff
  NewFlush,
];

