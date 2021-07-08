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

import { EventParser, Writer } from "wbxml";
import ASCP from "activesync/codepages";

/**
 * ORPHANED COMMENT FROM ActiveSyncAccount.  Repurpose when hooking this up.
 *
 * Create a folder that is the child/descendant of the given parent folder.
 * If no parent folder id is provided, we attempt to create a root folder.
 *
 * NOTE: This function is currently unused.  It might have been used for
 * testing at some point.  It will be used again someday but should not be
 * assumed to actually work when that day comes.
 *
 * @args[
 *   @param[parentFolderId String]
 *   @param[folderName]
 *   @param[containOnlyOtherFolders Boolean]{
 *     Should this folder only contain other folders (and no messages)?
 *     On some servers/backends, mail-bearing folders may not be able to
 *     create sub-folders, in which case one would have to pass this.
 *   }
 *   @param[callback @func[
 *     @args[
 *       @param[error @oneof[
 *         @case[null]{
 *           No error, the folder got created and everything is awesome.
 *         }
 *         @case['offline']{
 *           We are offline and can't create the folder.
 *         }
 *         @case['already-exists']{
 *           The folder appears to already exist.
 *         }
 *         @case['unknown']{
 *           It didn't work and we don't have a better reason.
 *         }
 *       ]]
 *       @param[folderMeta ImapFolderMeta]{
 *         The meta-information for the folder.
 *       }
 *     ]
 *   ]]{
 *   }
 * ]
 */

/**
 * Create a folder
 *
 * @param {ActiveSyncConnection} conn
 * @param {Object} args
 * @param {FolderSyncKey} args.folderSyncKey
 *   The sync key we use for FolderSync purposes on this account.  Note that
 *   this value should be replaced with the returned updated folderSyncKey.
 * @param {ActivesyncFolderServerId} args.parentFolderServerId
 * @param {String} args.folderName
 *
 * @return {{ serverId, folderSyncKey }}
 */
export default async function createFolder(conn, args) {
  const fh = ASCP.FolderHierarchy.Tags;
  const fhStatus = ASCP.FolderHierarchy.Enums.Status;
  const folderType = ASCP.FolderHierarchy.Enums.Type.Mail;

  let w = new Writer("1.3", 1, "UTF-8");
  w.stag(fh.FolderCreate)
    .tag(fh.SyncKey, args.folderSyncKey)
    .tag(fh.ParentId, args.parentFolderServerId)
    .tag(fh.DisplayName, args.folderName)
    .tag(fh.Type, folderType)
    .etag();

  let response = await conn.postCommand(w);

  let e = new EventParser();
  let status, serverId, newFolderSyncKey;

  e.addEventListener([fh.FolderCreate, fh.Status], function(node) {
    status = node.children[0].textContent;
  });
  e.addEventListener([fh.FolderCreate, fh.SyncKey], function(node) {
    newFolderSyncKey = node.children[0].textContent;
  });
  e.addEventListener([fh.FolderCreate, fh.ServerId], function(node) {
    serverId = node.children[0].textContent;
  });

  try {
    e.run(response);
  } catch (ex) {
    console.error("Error parsing FolderCreate response:", ex, "\n", ex.stack);
    throw new Error("unknown");
  }

  if (status === fhStatus.Success) {
    return { serverId, folderSyncKey: newFolderSyncKey };
  } else if (status === fhStatus.FolderExists) {
    throw new Error("already-exists");
  } else {
    throw new Error("unknown");
  }
}
