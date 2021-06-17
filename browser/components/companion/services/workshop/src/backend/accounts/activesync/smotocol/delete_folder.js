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

import $wbxml from "wbxml";
import ASCP from "activesync/codepages";

/**
 * Delete a folder.
 *
 * @param {ActiveSyncConnection} conn
 * @param {Object} args
 * @param {FolderSyncKey} args.folderSyncKey
 *   The sync key we use for FolderSync purposes on this account.
 *   TODO: Better understand whether this should also be an output somehow or,
 *   if not, an explanation of why it doesn't have to be.  Explanation can just
 *   be "it's ActiveSync!"
 * @param {ActivesyncFolderServerId} args.serverId
 *
 * @return {{ serverId, folderSyncKey }}
 */
export default async function deleteFolder(conn, args) {
  const fh = ASCP.FolderHierarchy.Tags;
  const fhStatus = ASCP.FolderHierarchy.Enums.Status;

  let w = new $wbxml.Writer("1.3", 1, "UTF-8");
  w.stag(fh.FolderDelete)
    .tag(fh.SyncKey, args.folderSyncKey)
    .tag(fh.ServerId, args.serverId)
    .etag();

  let response = await conn.postCommand(w);

  let e = new $wbxml.EventParser();
  let status, serverId, newFolderSyncKey;

  e.addEventListener([fh.FolderDelete, fh.Status], function(node) {
    status = node.children[0].textContent;
  });
  e.addEventListener([fh.FolderDelete, fh.SyncKey], function(node) {
    newFolderSyncKey = node.children[0].textContent;
  });

  try {
    e.run(response);
  } catch (ex) {
    console.error("Error parsing FolderDelete response:", ex, "\n", ex.stack);
    throw new Error("unknown");
  }

  if (status === fhStatus.Success) {
    return { serverId, folderSyncKey: newFolderSyncKey };
  }

  throw new Error("unknown");
}
