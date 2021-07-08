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

import { EventParser, Writer } from "wbxml";
import $as from "activesync/codepages/AirSync";

import parseFullMessage from "./parse_full_message";
import parseChangedMessage from "./parse_changed_message";

/**
 * High-level synchronization of the contents of a folder.  This routine
 * requires that a believed-valid syncKey and the filterType configured for that
 * syncKey are provided.  Results are provided by invoking the passed-in evt.js
 * Emitter with 'add', 'change', and 'remove' events as the WBXML stream is
 * parsed.  (Having us return a generator was considered but the control flow
 * gets potentially complex there, and as we move to streams for parsing, the
 * event emitter is arguably more aligned with that.)
 *
 * Note that it is possible the syncKey is no longer valid, in which case no
 * events will be emitted and our return value will have `invalidSyncKey` be
 * true.  That should be addressed and a new syncKey established before invoking
 * us again.
 *
 * NB: We used to have an empty request/response optimization.  In general this
 * has only brought us pain (device-id's were involved too.)  The optimization
 * has been ditched since it's not safe if we're doing multiple requests in
 * parallel without extensive coordination.
 *
 * @param {ActiveSyncConnection} conn
 * @param {Object} args
 * @param {String} args.folderServerId
 * @param {String} args.folderSyncKey
 * @param {String} args.filterType
 * @param {Function} args.issueIds
 *   Hacky hack that needs to return { messageId, umid, folderId } where the
 *   umid and derived messageId are freshly generated.  The rationale for
 *   doing this is to avoid that very-specific logic ending up in this file.
 * @param {Emitter} args.emitter
 *   The evt Emitter on which we fire add/change/remove events.
 *
 * @return {{ invalidSyncKey, syncKey, moreToSync }}
 */
export default async function enumerateFolderChanges(
  conn,
  { folderSyncKey, folderServerId, filterType, issueIds, emitter }
) {
  let w = new Writer("1.3", 1, "UTF-8");
  w.stag($as.Tags.Sync)
    .stag($as.Tags.Collections)
    .stag($as.Tags.Collection);

  if (conn.currentVersion.lt("12.1")) {
    w.tag($as.Tags.Class, "Email");
  }

  w.tag($as.Tags.SyncKey, folderSyncKey)
    .tag($as.Tags.CollectionId, folderServerId)
    .tag($as.Tags.GetChanges)
    .stag($as.Tags.Options)
    .tag($as.Tags.FilterType, filterType);

  // Older versions of ActiveSync give us the body by default. Ensure they
  // omit it.
  if (conn.currentVersion.lte("12.0")) {
    w.tag($as.Tags.MIMESupport, $as.Enums.MIMESupport.Never).tag(
      $as.Tags.Truncation,
      $as.Enums.MIMETruncation.TruncateAll
    );
  }

  w.etag()
    .etag()
    .etag()
    .etag();

  let response = await conn.postCommand(w);

  // Blank responses are the server's way of telling us nothing has changed.
  // So just fast-path out and leave the syncState the same.
  if (!response) {
    logic(conn, "syncComplete", { emptyResponse: true });
    return {
      invalidSyncKey: false,
      syncKey: folderSyncKey,
      moreAvailable: false,
      noChanges: true,
    };
  }

  let e = new EventParser();
  let base = [$as.Tags.Sync, $as.Tags.Collections, $as.Tags.Collection];

  let status;
  let newSyncKey;
  let moreAvailable = false;
  let addCount = 0,
    changeCount = 0,
    removeCount = 0;

  e.addEventListener(base.concat($as.Tags.SyncKey), function(node) {
    newSyncKey = node.children[0].textContent;
  });

  e.addEventListener(base.concat($as.Tags.Status), function(node) {
    status = node.children[0].textContent;
  });

  e.addEventListener(base.concat($as.Tags.MoreAvailable), function(node) {
    moreAvailable = true;
  });

  e.addEventListener(base.concat($as.Tags.Commands, $as.Tags.Add), function(
    node
  ) {
    let messageServerId, nodeToParse;

    for (let child of node.children) {
      switch (child.tag) {
        case $as.Tags.ServerId:
          messageServerId = child.children[0].textContent;
          break;
        case $as.Tags.ApplicationData:
          nodeToParse = child;
          break;
        default:
          break;
      }
    }

    if (nodeToParse && messageServerId) {
      try {
        let message = parseFullMessage(nodeToParse, issueIds());
        addCount++;
        emitter.emit("add", messageServerId, message);
      } catch (ex) {
        // If we get an error, just log it and skip this message.
        console.error("Failed to parse a full message:", ex, "\n", ex.stack);
      }
    }
  });

  e.addEventListener(base.concat($as.Tags.Commands, $as.Tags.Change), function(
    node
  ) {
    let messageServerId, changes;

    for (let child of node.children) {
      switch (child.tag) {
        case $as.Tags.ServerId:
          messageServerId = child.children[0].textContent;
          break;
        case $as.Tags.ApplicationData:
          try {
            changes = parseChangedMessage(child);
          } catch (ex) {
            // If we get an error, just log it and skip this message.
            console.error("Failed to parse a change:", ex, "\n", ex.stack);
            return;
          }
          break;
        default:
          break;
      }
    }

    if (messageServerId && changes) {
      changeCount++;
      emitter.emit("change", messageServerId, changes);
    }
  });

  e.addEventListener(
    base.concat($as.Tags.Commands, [[$as.Tags.Delete, $as.Tags.SoftDelete]]),
    function(node) {
      let messageServerId;

      for (let child of node.children) {
        switch (child.tag) {
          case $as.Tags.ServerId:
            messageServerId = child.children[0].textContent;
            break;
          default:
            break;
        }
      }

      if (messageServerId) {
        removeCount++;
        emitter.emit("remove", messageServerId);
      }
    }
  );

  try {
    e.run(response);
  } catch (ex) {
    console.error("Error parsing Sync response:", ex, "\n", ex.stack);
    throw new Error("unknown");
  }

  if (status === $as.Enums.Status.Success) {
    logic(conn, "syncComplete", {
      added: addCount,
      changed: changeCount,
      removed: removeCount,
    });

    return { invalidSyncKey: false, syncKey: newSyncKey, moreAvailable };
  } else if (status === $as.Enums.Status.InvalidSyncKey) {
    return { invalidSyncKey: true, syncKey: "0", moreAvailable };
  }

  logic(conn, "syncError", { status });
  throw new Error("unknown");
}
