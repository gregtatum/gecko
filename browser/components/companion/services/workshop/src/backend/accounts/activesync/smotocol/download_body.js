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
import $asb from "activesync/codepages/AirSyncBase";

/**
 * Download a possibly truncated message body for 12.0 and higher servers.
 *
 * @param {ActiveSyncConnection} conn
 * @param {Object} args
 * @param {Type} [args.truncationSize]
 * @param {Emitter} args.emitter
 *   The evt Emitter on which we fire add/change/remove events.
 *
 * @return {{ invalidSyncKey, moreToSync }}
 */
export default async function downloadBody(
  conn,
  { folderServerId, messageServerId, bodyType, truncationSize }
) {
  let w = new Writer("1.3", 1, "UTF-8");
  w.stag(io.Tags.Tags.ItemOperations)
    .stag(io.Tags.Fetch)
    .tag(io.Tags.Store, "Mailbox")
    .tag($as.Tags.CollectionId, folderServerId)
    .tag($as.Tags.ServerId, messageServerId)
    .stag(io.Tags.Options)
    // Only get the AirSyncBase:Body element to minimize bandwidth.
    .stag(io.Tags.Schema)
    .tag($asb.Tags.Body)
    .etag()
    .stag($asb.Tags.BodyPreference)
    .tag($asb.Tags.Type, bodyType);

  if (truncationSize) {
    w.tag($asb.Tags.TruncationSize, truncationSize);
  }

  w.etag()
    .etag()
    .etag()
    .etag();

  let response = await conn.postCommand(w);

  let e = new EventParser();
  let status, bodyContent;
  e.addEventListener([io.Tags.ItemOperations, io.Tags.Status], function(node) {
    status = node.children[0].textContent;
  });
  e.addEventListener(
    [
      io.Tags.ItemOperations,
      io.Tags.Response,
      io.Tags.Fetch,
      io.Tags.Properties,
      $asb.Tags.Body,
      $asb.Tags.Data,
    ],
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

  return { bodyContent };
}
