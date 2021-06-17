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

import ContactCache from "gelam/clientapi/contact_cache";

import cleanupConversation from "./conv_client_cleanup";

/**
 * Put stuff that our "conv_churn.js" created onto the MailConversation
 * instance.  Cleanup happens in "conv_client_cleanup.js".
 */
export default function decorateConversation(
  mailConversation,
  wireRep,
  firstTime
) {
  // Delta-computing peeps is hard, forget them all then re-resolve them all.
  // We have a cache.  It's fine.
  if (!firstTime) {
    cleanupConversation(mailConversation);
  }

  mailConversation.messageTidbits = wireRep.app.tidbits.map(tidbit => {
    return {
      id: tidbit.id,
      date: new Date(tidbit.date),
      isRead: tidbit.isRead,
      isStarred: tidbit.isStarred,
      author: ContactCache.resolvePeep(tidbit.author),
      parentIndex: tidbit.parent,
    };
  });

  if (wireRep.app.patchInfo) {
    mailConversation.drevInfo = wireRep.app.drevInfo;
    mailConversation.patchInfo = wireRep.app.patchInfo;
  }
}
