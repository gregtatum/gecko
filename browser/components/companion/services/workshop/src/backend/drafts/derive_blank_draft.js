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

import {
  addressPairFromIdentity,
  replyToFromIdentity,
} from "./address_helpers";

import { generateBaseComposeParts } from "../bodies/mailchew";

import { makeMessageInfo, makeDraftInfo } from "../db/mail_rep";

/**
 * Create a blank message, noting that because of signatures this might not
 * actually be fully blank.
 */
export default function deriveBlankDraft({
  identity,
  messageId,
  umid,
  guid,
  date,
  folderIds,
}) {
  // -- Build the body
  let bodyReps = generateBaseComposeParts(identity);

  let draftInfo = makeDraftInfo({
    draftType: "blank",
    mode: null,
    refMessageId: null,
    refMessageDate: null,
  });

  return makeMessageInfo({
    id: messageId,
    umid,
    guid,
    date,
    author: addressPairFromIdentity(identity),
    // Forwarded messages have no automatic recipients
    to: [],
    cc: [],
    bcc: [],
    replyTo: replyToFromIdentity(identity),
    flags: [],
    folderIds,
    hasAttachments: false,
    subject: "",
    // There is no user-authored content at this point, so the snippet is empty
    // by definition.  draft_save will update this.
    snippet: "",
    attachments: [],
    relatedParts: [],
    references: [],
    bodyReps,
    draftInfo,
  });
}
