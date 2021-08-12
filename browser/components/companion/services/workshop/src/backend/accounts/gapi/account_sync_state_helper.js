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

import logic from "logic";

/**
 * Account global sync state, used by sync_folder_list to sync both the list of
 * known calendars and the list of known mail folders and to hold all the state
 * associated with doing that.  This data is stored in the database using the
 * `accountId` as the key.
 *
 * NOTE: Currently no data is stored here because the folder list sync doesn't
 * use a syncToken and we're also not synchronizing mail folders yet.  This
 * will change in the future and so I'm doing the legwork here.
 *
 * ASIDE: In ActiveSync we stored local folder id mappings to the server id
 * mappings, but that may have been a pre-convoy branch decision.  For now we're
 * just storing the serverId's on the FolderInfo reps themselves.
 */
export default class GapiAccountSyncStateHelper {
  constructor(ctx, rawSyncState, accountId) {
    if (!rawSyncState) {
      logic(ctx, "creatingDefaultSyncState", {});
      rawSyncState = {};
    }

    this._ctx = ctx;
    this._accountId = accountId;
    this.rawSyncState = rawSyncState;
  }
}
