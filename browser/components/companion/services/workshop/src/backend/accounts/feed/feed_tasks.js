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

import feed_syncFolderList from "./tasks/sync_folder_list";

import feed_syncItem from "./tasks/sync_item";
import feed_syncRefresh from "./tasks/sync_refresh";

import CommonAccountModify from "../../tasks/account_modify";
import CommonIdentityModify from "../../tasks/identity_modify";

import CommonNewTracking from "../../tasks/new_tracking";

export default [
  feed_syncFolderList,

  feed_syncItem,
  feed_syncRefresh,

  CommonAccountModify,
  CommonIdentityModify,

  CommonNewTracking,
];
