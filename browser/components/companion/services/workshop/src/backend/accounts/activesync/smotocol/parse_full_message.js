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

import mimetypes from "mimetypes";
import { parse as parseAddresses } from "addressparser";

import { encodeInt as encodeA64 } from "shared/a64";

import * as mailRep from "../../../db/mail_rep";

import asb from "activesync/codepages/AirSyncBase";
import em from "activesync/codepages/Email";

/**
 * Parse the given WBXML server representation of a message into a GELAM backend
 * MessageInfo representation.
 *
 * Historical note: In v1 we had a single parsing function that operated in a
 * full parsing mode or a changed parsing mode and involved clever helper
 * functions.  It has been split into this function and parsedChangeMessage in
 * the interest of readability.
 *
 * @param {WBXML.Element} node
 */
export default function parseFullMessage(node, { messageId, umid, folderId }) {
  // The representation we mutate into shape.  This will eventually be passed
  // through `makeMessageInfo` in mail_rep.js.
  let scratchMsg = {
    id: messageId,
    umid,
    // ActiveSync does not/cannot tell us the Message-ID header unless we
    // fetch the entire MIME body
    guid: "",
    author: null,
    to: null,
    cc: null,
    bcc: null,
    replyTo: null,
    date: null,
    flags: [],
    folderIds: new Set([folderId]),
    hasAttachments: false,
    subject: null,
    snippet: null,
    attachments: [],
    relatedParts: [],
    references: [],
    bodyReps: null,
  };

  let bodyType, bodySize;

  for (let child of node.children) {
    let childText = child.children.length
      ? child.children[0].textContent
      : null;

    switch (child.tag) {
      case em.Tags.Subject:
        scratchMsg.subject = childText;
        break;
      case em.Tags.From:
        scratchMsg.author = parseAddresses(childText)[0] || null;
        break;
      case em.Tags.To:
        scratchMsg.to = parseAddresses(childText);
        break;
      case em.Tags.Cc:
        scratchMsg.cc = parseAddresses(childText);
        break;
      case em.Tags.ReplyTo:
        scratchMsg.replyTo = parseAddresses(childText);
        break;
      case em.Tags.DateReceived:
        scratchMsg.date = new Date(childText).valueOf();
        break;
      case em.Tags.Read:
        if (childText === "1") {
          scratchMsg.flags.push("\\Seen");
        }
        break;
      case em.Tags.Flag:
        for (let grandchild of child.children) {
          if (
            grandchild.tag === em.Tags.Status &&
            grandchild.children[0].textContent !== "0"
          ) {
            scratchMsg.flags.push("\\Flagged");
          }
        }
        break;
      case asb.Tags.Body: // ActiveSync 12.0+
        for (let grandchild of child.children) {
          switch (grandchild.tag) {
            case asb.Tags.Type:
              var type = grandchild.children[0].textContent;
              if (type === asb.Enums.Type.HTML) {
                bodyType = "html";
              } else {
                // I've seen a handful of extra-weird messages with body types
                // that aren't plain or html. Let's assume they're plain,
                // though.
                if (type !== asb.Enums.Type.PlainText) {
                  console.warn("A message had a strange body type:", type);
                }
                bodyType = "plain";
              }
              break;
            case asb.Tags.EstimatedDataSize:
              bodySize = grandchild.children[0].textContent;
              break;
            default:
              // Ignore other tag types.
              break;
          }
        }
        break;
      case em.Tags.BodySize: // pre-ActiveSync 12.0
        bodyType = "plain";
        bodySize = childText;
        break;
      case asb.Tags.Attachments: // ActiveSync 12.0+
      case em.Tags.Attachments: // pre-ActiveSync 12.0
        for (let attachmentNode of child.children) {
          if (
            attachmentNode.tag !== asb.Tags.Attachment &&
            attachmentNode.tag !== em.Tags.Attachment
          ) {
            continue;
          }

          let attachment = {
            relId: encodeA64(scratchMsg.attachments.length),
            name: null,
            contentId: null,
            type: null,
            part: null,
            encoding: null,
            sizeEstimate: null,
            downloadState: null,
            file: null,
          };

          let isInline = false;
          for (let attachData of attachmentNode.children) {
            let dot, ext;
            let attachDataText = attachData.children.length
              ? attachData.children[0].textContent
              : null;

            switch (attachData.tag) {
              case asb.Tags.DisplayName:
              case em.Tags.DisplayName:
                attachment.name = attachDataText;

                // Get the file's extension to look up a mimetype, but ignore it
                // if the filename is of the form '.bashrc'.
                dot = attachment.name.lastIndexOf(".");
                ext =
                  dot > 0
                    ? attachment.name.substring(dot + 1).toLowerCase()
                    : "";
                attachment.type = mimetypes.detectMimeType(ext);
                break;
              case asb.Tags.FileReference:
              case em.Tags.AttName:
              case em.Tags.Att0Id:
                attachment.part = attachDataText;
                break;
              case asb.Tags.EstimatedDataSize:
              case em.Tags.AttSize:
                attachment.sizeEstimate = parseInt(attachDataText, 10);
                break;
              case asb.Tags.ContentId:
                attachment.contentId = attachDataText;
                break;
              case asb.Tags.IsInline:
                isInline = attachDataText === "1";
                break;
              default:
                // Ignore other tag types.
                break;
            }
          }

          if (isInline) {
            scratchMsg.relatedParts.push(
              mailRep.makeAttachmentPart(attachment)
            );
          } else {
            scratchMsg.attachments.push(mailRep.makeAttachmentPart(attachment));
          }
        }
        scratchMsg.hasAttachments = !!scratchMsg.attachments.length;
        break;
      default:
        // Ignore other tag types.
        break;
    }
  }

  scratchMsg.bodyReps = [
    mailRep.makeBodyPart({
      type: bodyType,
      sizeEstimate: bodySize,
      amountDownloaded: 0,
      isDownloaded: false,
    }),
  ];

  return mailRep.makeMessageInfo(scratchMsg);
}
