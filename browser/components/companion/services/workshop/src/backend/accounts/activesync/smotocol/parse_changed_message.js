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

import em from "activesync/codepages/Email";

/**
 * Parse the given WBXML server representation of a changed message into a
 * flag changes representation.
 *
 * @param {WBXML.Element} node
 */
export default function parseChangedMessage(node) {
  let flagChanges = {
    add: null,
    remove: null,
  };

  function setFlagState(flag, beSet) {
    if (beSet) {
      if (!flagChanges.add) {
        flagChanges.add = [];
      }
      flagChanges.add.push(flag);
    } else {
      if (!flagChanges.remove) {
        flagChanges.remove = [];
      }
      flagChanges.remove.push(flag);
    }
  }

  for (let child of node.children) {
    let childText = child.children.length
      ? child.children[0].textContent
      : null;

    switch (child.tag) {
      case em.Tags.Read:
        setFlagState("\\Seen", childText === "1");
        break;
      case em.Tags.Flag:
        for (let grandchild of child.children) {
          if (grandchild.tag === em.Tags.Status) {
            setFlagState(
              "\\Flagged",
              grandchild.children[0].textContent !== "0"
            );
          }
        }
        break;
      default:
        break;
    }
  }

  return { flagChanges };
}
