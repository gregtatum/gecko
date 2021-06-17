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

import { addressMatches, cloneRecipients } from './address_helpers';

/**
 * Given the original recipients of a message, and the author who wants to reply
 * to that message, figure out the new set of recipients for the normal "reply"
 * logic.  The trick is that if "we" wrote the message we're replying to, then
 * we want to reuse the original to list (ignoring cc/bcc) rather than creating
 * a message to send to ourselves.  This usually happens in the sent folder.
 */
export default function replyToSenderRecipients(sourceRecipients, sourceAuthor,
                                        replyAuthor) {
  if (addressMatches(sourceAuthor, replyAuthor)) {
    return cloneRecipients(sourceRecipients);
  } else {
    return {
      to: [sourceAuthor],
      cc: [],
      bcc: []
    };
  }
};

