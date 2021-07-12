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
import fh from "activesync/codepages/FolderHierarchy";

/**
 * High-level synchronization of the contents of a folder.  This routine
 * requires that a believed-valid syncKey and the filterType configured for that
 * syncKey are provided.  Results are provided by invoking the passed-in evt.js
 * Emitter with 'add', and 'remove' events as the WBXML stream is
 * parsed.  This is done for consistency with enum_folder_changes.  We don't
 * actually believe that there are resource use reasons for this control flow.
 *
 * The add event object contains { ServerId, ParentId, DisplayName, Type }.
 *
 * @param {ActiveSyncConnection} conn
 * @param {Object} args
 * @param {String} args.hierarchySyncKey
 * @param {Emitter} args.emitter
 *   The evt Emitter on which we fire add/change/remove events.
 *
 * @return {{ invalidSyncKey, moreToSync }}
 */
export default async function enumerateHierarchyChanges(
  conn,
  { hierarchySyncKey, emitter }
) {
  let w = new Writer("1.3", 1, "UTF-8");
  w.stag(fh.Tags.FolderSync)
    .tag(fh.Tags.SyncKey, hierarchySyncKey)
    .etag();

  let response = await conn.postCommand(w);

  let e = new EventParser();
  let newSyncKey;

  e.addEventListener([fh.Tags.FolderSync, fh.Tags.SyncKey], function(node) {
    newSyncKey = node.children[0].textContent;
  });

  e.addEventListener(
    [fh.Tags.FolderSync, fh.Tags.Changes, [fh.Tags.Add, fh.Tags.Delete]],
    function(node) {
      let folderArgs = {};
      for (let child of node.children) {
        folderArgs[child.localTagName] = child.children[0].textContent;
      }

      if (node.tag === fh.Tags.Add) {
        emitter.emit("add", folderArgs);
      } else {
        emitter.emit("remove", folderArgs.ServerId);
      }
    }
  );

  try {
    e.run(response);
  } catch (ex) {
    console.error("Error parsing FolderSync response:", ex, "\n", ex.stack);
    throw new Error("unknown");
  }

  // TODO: it seems like it must be possible for this to indicate an invalid
  // syncKey.  We've probably been skirting by on a lack of changes to accounts.
  // I'm not addressing this immediately right now since our randomly generated
  // device id's should be saving us from situations where this would go bad.

  return { hierarchySyncKey: newSyncKey };
}
