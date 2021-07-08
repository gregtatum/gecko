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
import io from "activesync/codepages/ItemOperations";
import $as from "activesync/codepages/AirSync";
import em from "activesync/codepages/Email";

/**
 * Download a the entire message body for protocol 2.5 servers; there is no
 * truncation apparently.  Which sucks.
 * TODO: try and avoid always downloading the whole body, but we haven't gotten
 * around to it since day 1, and no one has really complained, so maybe this
 * isn't so bad?  (Also, maybe we have no way to do better.)
 *
 * @param {ActiveSyncConnection} conn
 * @param {Object} args
 * @param {Emitter} args.emitter
 *   The evt Emitter on which we fire add/change/remove events.
 *
 * @return {{ syncKey, bodyContent }}
 */
export default async function downloadBody(
  conn,
  { folderSyncKey, folderServerId, messageServerId, bodyType }
) {
  let w = new Writer("1.3", 1, "UTF-8");
  w.stag($as.Tags.Sync)
    .stag($as.Tags.Collections)
    .stag($as.Tags.Collection)
    .tag($as.Tags.Class, "Email")
    .tag($as.Tags.SyncKey, folderSyncKey) // XXX ugh, can we remove this?
    .tag($as.Tags.CollectionId, folderServerId)
    .stag($as.Tags.Options)
    .tag($as.Tags.MIMESupport, $as.Tags.Enums.MIMESupport.Never)
    .etag()
    .stag($as.Tags.Commands)
    .stag($as.Tags.Fetch)
    .tag($as.Tags.ServerId, messageServerId)
    .etag()
    .etag()
    .etag()
    .etag()
    .etag();

  let response = await conn.postCommand(w);

  let e = new EventParser();
  let base = [$as.Tags.Sync, $as.Tags.Collections, $as.Tags.Collection];
  let newSyncKey, status, bodyContent;

  e.addEventListener(base.concat($as.Tags.SyncKey), function(node) {
    newSyncKey = node.children[0].textContent;
  });
  e.addEventListener(base.concat($as.Tags.Status), function(node) {
    status = node.children[0].textContent;
  });
  e.addEventListener(
    base.concat(
      $as.Tags.Responses,
      $as.Tags.Fetch,
      $as.Tags.ApplicationData,
      em.Tags.Body
    ),
    function(node) {
      bodyContent = node.children[0].textContent;
    }
  );

  try {
    e.run(response);
  } catch (ex) {
    console.error("Error parsing FolderSync response:", ex, "\n", ex.stack);
    throw new Error("unknown");
  }

  if (status !== io.Enums.Status.Success) {
    throw new Error("unknown");
  }

  return { syncKey: newSyncKey, bodyContent };
}
