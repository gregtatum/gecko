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

import * as mailRep from "../../db/mail_rep";
import { processMessageContent } from "../../bodies/mailchew";
import { makeMessageId } from "shared/id_conversions";

export class FeedItemChewer {
  constructor({ convId, item, foldersTOC }) {
    this.convId = convId;
    this.item = item;
    this.foldersTOC = foldersTOC;
    this.inboxFolder = foldersTOC.getCanonicalFolderByType("inbox");
    this.allMessages = [];
  }

  async chewItem() {
    const item = this.item;
    let contentBlob, snippet, authoredBodySize;
    let bodyReps = [];
    // For now there's only ever a single message in the conversation, so we
    // arbitrarily choose to use "0" as the MessageIdComponent.
    const msgId = makeMessageId(this.convId, "0");

    if (item.description) {
      const description = item.description;
      ({ contentBlob, snippet, authoredBodySize } = await processMessageContent(
        description,
        item.contentType,
        true, // isDownloaded
        true // generateSnippet
      ));

      bodyReps.push(
        mailRep.makeBodyPart({
          type: item.contentType,
          part: null,
          sizeEstimate: description.length,
          amountDownloaded: description.length,
          isDownloaded: true,
          _partInfo: null,
          contentBlob,
          authoredBodySize,
        })
      );
    }

    const msgInfo = mailRep.makeMessageInfo({
      id: msgId,
      umid: null,
      guid: item.guid,
      date: item.date,
      dateModified: item.dateModified,
      author: item.author,
      flags: [],
      folderIds: new Set([this.inboxFolder.id]),
      subject: item.title,
      snippet,
      attachments: [],
      relatedParts: null,
      references: null,
      bodyReps,
      authoredBodySize,
      draftInfo: null,
    });

    this.allMessages.push(msgInfo);
  }
}
