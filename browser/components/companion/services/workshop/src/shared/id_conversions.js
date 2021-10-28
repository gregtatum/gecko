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
 *
 * ## Terminology
 *
 * - IdComponent: A
 * - Id / Identifier: An opaque
 *
 * ## Our Identifiers
 *
 * - AccountId: a64-encoded sequentially issued account number.  The
 *   `nextAccountNum` is maintained on the global configuration and will not
 *   reusee identifiers.
 * - FolderId: `${AccountId}\0${FolderIdComponent}` - A folder id is the account
 *   id of the account the folder belongs to, followed by a `\0`, followed by
 *   the `FolderIdComponent` which is an a64-encoded sequentially-ish issued
 *   number as determined by the `FoldersTOC`.  The `FoldersTOC` determines the
 *   highest FolderId it knows about when initialized and adds one to it, which
 *   means that folder ids can be reused if the workshop backend is restarted.
 * - ConversationId:
 *   `${AccountId}\0${FolderNamespaceComponent}\0${ConversationIdComponent}` -
 *   A conversation id is the account id the conversation belongs to, followed
 *   by a `\0`, followed by either 1) an empty string if the identifier is
 *   global throughout the account or 2) the FolderIdComponent the identifier is
 *   local to.
 * - MessageId / EventId: `${ConversationId}\0${MessageIdComponent}` where
 *   `ConversationId` is itself the 3-part composite identifier above so we
 *   would have a total of 4 parts with 3 embedded nul characters.
 *
 * - IdentityId: `${AccountId}\0${IdentityIdComponent}` - Same situation as
 *   a FolderId; it's an a64-encoded sequentially-ish issued identifier that's
 *   namespaced by the account.
 *
 * ## Invariant Checking
 *
 * The methods in this file currently will always validate that any provided
 * identifier has the expected number of components when split on `\0`.  This
 * is intended to help catch misuse and can potentially be relaxed in the
 * future, especially if we are able to use typescript analysis (from comments)
 * to help validate things more statically.
 **/

import { decodeA64Int, encodeInt } from "shared/a64";

// ## AccountId

/**
 * @param {Number} accountNum
 * @returns {AccountId}
 */
export function makeAccountId(accountNum) {
  return encodeInt(accountNum);
}

// ## IdentityId

/**
 * @param {AccountId} accountId
 * @param {Number} identityNum
 * @returns {ConversationId}
 */
export function makeIdentityId(accountId, identityNum) {
  if (/\0/.test(accountId)) {
    throw new Error(`AccountId '${accountId}' has a nul!`);
  }
  return `${accountId}\0${encodeInt(identityNum)}`;
}

export function accountIdFromIdentityId(identityId) {
  const pieces = identityId.split(/\0/g);
  if (pieces.length !== 2) {
    throw new Error(`Malformed IdentityId: ${identityId}`);
  }
  return pieces[0];
}

export function getAccountIdBounds(accountId) {
  // Build a range that covers our family of keys where we use an
  // array whose first item is a string id that is a concatenation of
  // `AccountId`, the string "\0", and then some more array parts.  Our
  // prefix string provides a lower bound, and the prefix with the
  // highest possible unicode character thing should be strictly
  // greater than any legal suffix (\ufff0 not being a legal suffix
  // in our key-space.)
  return {
    lower: accountId + "\0",
    upper: accountId + "\0\ufff0",
  };
}

// ## FolderId

/**
 * @param {AccountId} accountId
 * @param {Number} folderNum
 * @returns {ConversationId}
 */
export function makeFolderId(accountId, folderNum) {
  if (/\0/.test(accountId)) {
    throw new Error(`AccountId '${accountId}' has a nul!`);
  }
  return `${accountId}\0${encodeInt(folderNum)}`;
}

/**
 * @param {FolderId} folderId
 * @returns {AccountId}
 */
export function accountIdFromFolderId(folderId) {
  const pieces = folderId.split(/\0/g);
  if (pieces.length !== 2) {
    throw new Error(`Malformed FolderId: ${folderId}`);
  }
  return pieces[0];
}

/**
 * Return the JS Number that the FolderIdComponent portion of the FolderId
 * represents by decoding its a64 representation.
 *
 * @param {FolderId} folderId
 * @returns {Number}
 */
export function decodeFolderIdComponentFromFolderId(folderId) {
  const pieces = folderId.split(/\0/g);
  if (pieces.length !== 2) {
    throw new Error(`Malformed FolderId: ${folderId}`);
  }
  return decodeA64Int(pieces[1]);
}

// ## ConversationId

/**
 * @param {FolderId} folderId
 * @param {ConversationIdComponent} convIdComponent
 * @returns {ConversationId}
 */
export function makeFolderNamespacedConvId(folderId, convIdComponent) {
  const pieces = folderId.split(/\0/g);
  if (pieces.length !== 2) {
    throw new Error(`Malformed FolderId: ${folderId}`);
  }
  if (/\0/.test(convIdComponent)) {
    throw new Error(`ConvIdComnponent '${convIdComponent}' has a nul!`);
  }
  return `${folderId}\0${convIdComponent}`;
}

/**
 * @param {AccountId} accountId
 * @param {ConversationIdComponent} convIdComponent
 * @returns {ConversationId}
 */
export function makeGlobalNamespacedConvId(accountId, convIdComponent) {
  if (/\0/.test(accountId)) {
    throw new Error(`AccountId '${accountId}' has a nul!`);
  }
  return `${accountId}\0\0${convIdComponent}`;
}

/**
 * @param {ConversationId} convId
 * @returns {AccountId}
 */
export function accountIdFromConvId(convId) {
  const pieces = convId.split(/\0/g);
  if (pieces.length !== 3) {
    throw new Error(`Malformed ConversationId: ${convId}`);
  }
  return pieces[0];
}

/**
 * @param {ConversationId} convId
 * @returns {FolderNamespaceComponent}
 */
export function folderNamespaceComponentFromConvId(convId) {
  const pieces = convId.split(/\0/g);
  if (pieces.length !== 3) {
    throw new Error(`Malformed ConversationId: ${convId}`);
  }
  return pieces[1];
}

/**
 * @param {ConversationId} convId
 * @returns {ConversationIdComponent}
 */
export function convIdComponentFromConvId(convId) {
  const pieces = convId.split(/\0/g);
  if (pieces.length !== 3) {
    throw new Error(`Malformed ConversationId: ${convId}`);
  }
  return pieces[2];
}

// ## MessageId

/**
 * @param {ConversationId} convId
 * @param {MessageIdComponent} messageIdComponent
 * @returns {MessageId}
 */
export function makeMessageId(convId, messageIdComponent) {
  const pieces = convId.split(/\0/g);
  if (pieces.length !== 3) {
    throw new Error(`Malformed ConversationId: ${convId}`);
  }
  if (/\0/.test(messageIdComponent)) {
    throw new Error(`MessageIdComponent '${messageIdComponent}' has a nul!`);
  }
  return `${convId}\0${messageIdComponent}`;
}

/**
 * @param {MessageId} messageId
 * @returns {AccountId}
 */
export function accountIdFromMessageId(messageId) {
  const pieces = messageId.split(/\0/g);
  if (pieces.length !== 4) {
    throw new Error(`Malformed MessageId: ${messageId}`);
  }
  return pieces[0];
}

/**
 * @param {MessageId} messageId
 * @returns {ConversationId}
 */
export function convIdFromMessageId(messageId) {
  const pieces = messageId.split(/\0/g);
  if (pieces.length !== 4) {
    throw new Error(`Malformed MessageId: ${messageId}`);
  }
  return pieces.slice(0, 3).join("\0");
}

/**
 * @param {MessageId} messageId
 * @returns {ConversationIdComponent}
 */
export function convIdComponentFromMessageId(messageId) {
  const pieces = messageId.split(/\0/g);
  if (pieces.length !== 4) {
    throw new Error(`Malformed MessageId: ${messageId}`);
  }
  return pieces[2];
}

/**
 * @param {MessageId} messageId
 * @returns {MessageIdComponent}
 */
export function messageIdComponentFromMessageId(messageId) {
  const pieces = messageId.split(/\0/g);
  if (pieces.length !== 4) {
    throw new Error(`Malformed MessageId: ${messageId}`);
  }
  return pieces[3];
}
