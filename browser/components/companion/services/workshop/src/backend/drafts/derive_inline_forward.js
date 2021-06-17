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

import {
  generateForwardSubject,
  generateForwardParts,
} from "../bodies/mailchew";

import { makeMessageInfo, makeDraftInfo } from "../db/mail_rep";

/**
 * Given a populated MessageInfo, derive a new MessageInfo that is an inline
 * forward of that message.  This is an inherently asynchronous process.
 */
export default async function deriveInlineForward({
  sourceMessage,
  identity,
  messageId,
  umid,
  guid,
  date,
  folderIds,
}) {
  // -- Subject
  let subject = generateForwardSubject(sourceMessage.subject);

  // -- Build the body
  let bodyReps = await generateForwardParts(sourceMessage, identity);

  let draftInfo = makeDraftInfo({
    draftType: "forward",
    mode: null,
    refMessageId: sourceMessage.id,
    refMessageDate: sourceMessage.date,
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
    subject,
    // There is no user-authored content at this point, so the snippet is empty
    // by definition.  draft_save will update this.
    snippet: "",
    attachments: [],
    relatedParts: [],
    // TODO: in Thunderbird I added a header that indicates the message-id of
    // the message that's getting forwarded for linkage purposes.  While that
    // does not go in here, it's something that would want to go around here in
    // an extra/custom-headers stashing place.
    references: [],
    bodyReps,
    draftInfo,
  });
}
