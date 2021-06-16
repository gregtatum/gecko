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

/**
 * Produce an ordering from newest conversation to oldest conversation, breaking
 * ties based on the conversation id in an arbitrary but consistent fashion.
 *
 * NEW-TO-OLD
 */
export function folderConversationComparator(a, b) {
  let dateDelta = b.date - a.date;
  if (dateDelta) {
    return dateDelta;
  }
  // So for the id's, we just want consistent.  We don't actually care about the
  // strict numerical ordering of the underlying conversation identifier (sans
  // account id), so we can just do lexical string ordering for this.
  let aId = a.id;
  let bId = b.id;
  if (bId > aId) {
    return 1;
  } else if (aId > bId) {
    return -1;
  } else {
    return 0;
  }
}

/**
 * Produce an ordering from newest message to oldest message, breaking ties
 * based on the id in an arbitrary but consistent fashion.
 *
 * NEW-TO-OLD currently for gaia mail ordering logic
 */
export function conversationMessageComparator(a, b) {
  let dateDelta = b.date - a.date;
  if (dateDelta) {
    return dateDelta;
  }
  // So for the id's, we just want consistent.  We don't actually care about the
  // strict numerical ordering of the underlying identifier, although the
  // differences will only start at the (encoded) raw message id.  Which is
  // arbitrary because it's something gmail assigns with no defined behaviour.
  let aId = a.id;
  let bId = b.id;
  if (bId > aId) {
    return 1;
  } else if (aId > bId) {
    return -1;
  } else {
    return 0;
  }
}

export function oldToNewConversationMessageComparator(a, b) {
  let dateDelta = a.date - b.date;
  if (dateDelta) {
    return dateDelta;
  }
  // So for the id's, we just want consistent.  We don't actually care about the
  // strict numerical ordering of the underlying identifier, although the
  // differences will only start at the (encoded) raw message id.  Which is
  // arbitrary because it's something gmail assigns with no defined behaviour.
  let aId = a.id;
  let bId = b.id;
  if (bId > aId) {
    return 1;
  } else if (aId > bId) {
    return -1;
  } else {
    return 0;
  }
}
