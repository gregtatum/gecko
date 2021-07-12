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
import $as from "activesync/codepages/AirSync";
import em from "activesync/codepages/Email";

/**
 * Modify one or messages in a folder by doing one or more of the following
 * things:
 * - Mark as read/unread
 * - Flag/unflag
 * - Delete the message
 * This notably does not include message moves.
 *
 * @param {ActiveSyncConnection} conn
 * @param {Object} args
 * @param {String} args.folderServerId
 * @param {Map<MessageServerId, BeRead>} args.read
 * @param {Map<MessageServerId, BeFlagged>} args.flag
 * @param {Set<MessageServerId>} args.delete
 * @param {Boolean} [permanentDeletion=false]
 *   Should deletions be irrevocable (versus moving to the trash folder)?
 */
export default async function modifyFolderMessages(conn, args) {
  let { folderServerId, folderSyncKey, permanentDeletion } = args;
  let readMap = args.read || new Map();
  let flagMap = args.flag || new Map();
  let deleteSet = args.delete || new Set();

  let w = new Writer("1.3", 1, "UTF-8");
  w.stag($as.Tags.Sync)
    .stag($as.Tags.Collections)
    .stag($as.Tags.Collection);

  if (conn.currentVersion.lt("12.1")) {
    w.tag($as.Tags.Class, "Email");
  }

  w.tag($as.Tags.SyncKey, folderSyncKey)
    .tag($as.Tags.CollectionId, folderServerId)
    .tag($as.Tags.DeletesAsMoves, permanentDeletion ? "0" : 1)
    // GetChanges defaults to true, so we must explicitly disable it to
    // avoid hearing about changes.
    .tag($as.Tags.GetChanges, "0")
    .stag($as.Tags.Commands);

  for (let [serverId, beRead] of readMap) {
    w.stag($as.Tags.Change)
      .tag($as.Tags.ServerId, serverId)
      .stag($as.Tags.ApplicationData)
      .tag(em.Tags.Read, beRead ? "1" : "0")
      .etag($as.Tags.ApplicationData)
      .etag($as.Tags.Change);
  }
  for (let [serverId, beFlagged] of flagMap) {
    w.stag($as.Tags.Change)
      .tag($as.Tags.ServerId, serverId)
      .stag($as.Tags.ApplicationData)
      .stag(em.Tags.Flag)
      .tag(em.Tags.Status, beFlagged ? "2" : "0")
      .etag()
      .etag($as.Tags.ApplicationData)
      .etag($as.Tags.Change);
  }
  for (let serverId of deleteSet) {
    w.stag($as.Tags.Delete)
      .tag($as.Tags.ServerId, serverId)
      .etag($as.Tags.Delete);
  }

  w.etag($as.Tags.Commands)
    .etag($as.Tags.Collection)
    .etag($as.Tags.Collections)
    .etag($as.Tags.Sync);

  let response = await conn.postCommand(w);

  let e = new EventParser();
  let newSyncKey, status;

  let base = [$as.Tags.Sync, $as.Tags.Collections, $as.Tags.Collection];
  e.addEventListener(base.concat($as.Tags.SyncKey), function(node) {
    newSyncKey = node.children[0].textContent;
  });
  e.addEventListener(base.concat($as.Tags.Status), function(node) {
    status = node.children[0].textContent;
  });

  try {
    e.run(response);
  } catch (ex) {
    console.error("Error parsing Sync mutation response:", ex, "\n", ex.stack);
    throw new Error("unknown");
  }

  if (status === $as.Enums.Status.Success) {
    return { syncKey: newSyncKey };
  }

  console.error(
    "Something went wrong during ActiveSync syncing and we " +
      "got a status of " +
      status
  );
  throw new Error("unknown");
}
