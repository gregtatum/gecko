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
import ie from "activesync/codepages/ItemEstimate";

/**
 * Get an estimate of the number of messages to be synced.
 * TODO: document how/why this needs both a syncKey and a filterType.  Very
 * confusing.  (Probably just the protocol being silly, but we should say that.)
 *
 * @param {ActiveSyncConnection} conn
 * @param {Object} args
 * @param {String} args.folderServerId
 * @param {String} args.folderSyncKey
 * @param {String} args.filterType
 */
export default async function getItemEstimate(
  conn,
  { folderSyncKey, folderServerId, filterType }
) {
  let w = new Writer("1.3", 1, "UTF-8");
  w.stag(ie.Tags.GetItemEstimate)
    .stag(ie.Tags.Collections)
    .stag(ie.Tags.Collection);

  if (conn.currentVersion.gte("14.0")) {
    w.tag($as.Tags.SyncKey, folderSyncKey)
      .tag(ie.Tags.CollectionId, folderServerId)
      .stag($as.Tags.Options)
      .tag($as.Tags.FilterType, filterType)
      .etag();
  } else if (conn.currentVersion.gte("12.0")) {
    w.tag(ie.Tags.CollectionId, folderServerId)
      .tag($as.Tags.FilterType, filterType)
      .tag($as.Tags.SyncKey, folderSyncKey);
  } else {
    w.tag(ie.Tags.Class, "Email")
      .tag($as.Tags.SyncKey, folderSyncKey)
      .tag(ie.Tags.CollectionId, folderServerId)
      .tag($as.Tags.FilterType, filterType);
  }

  w.etag(ie.Tags.Collection)
    .etag(ie.Tags.Collections)
    .etag(ie.Tags.GetItemEstimate);

  let response = await conn.postCommand(w);

  let e = new EventParser();
  let base = [ie.Tags.GetItemEstimate, ie.Tags.Response];

  let status, estimate;
  e.addEventListener(base.concat(ie.Tags.Status), function(node) {
    status = node.children[0].textContent;
  });
  e.addEventListener(
    base.concat(ie.Tags.Collection, ie.Tags.Estimate),
    function(node) {
      estimate = parseInt(node.children[0].textContent, 10);
    }
  );

  try {
    e.run(response);
  } catch (ex) {
    console.error("Error parsing FolderCreate response:", ex, "\n", ex.stack);
    throw new Error("unknown");
  }

  if (status !== ie.Enums.Status.Success) {
    throw new Error("unknown");
  } else {
    return { estimate };
  }
}
