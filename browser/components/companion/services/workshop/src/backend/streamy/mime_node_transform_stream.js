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

import { ReadableStream, WritableStream } from "streams";
import mimefuncs from "mimefuncs";

import jsmime from "jsmime";
import MimeHeaderInfo from "../mime/mime_header_info";
import BlobTransformStream from "./blob_transform_stream";

/**
 * MimeNodeTransformStream: A stream that receives lines of MIME data, and emits
 * an object for each MimeNode it encounters.
 *
 * Each time we parse a MIME header, we emit an object with the following:
 *
 *   var { partNum, headers, bodyStream } = yield stream.read();
 *
 * - `headers` is a MimeHeaderInfo structure for the given part.
 *
 * - `bodyStream` is a stream of partial blobs for this node.
 */
export default function MimeNodeTransformStream({ saveChunkSize, mimeType }) {
  var partToStreamControllerMap = new Map();
  var partToContentTypeMap = new Map();

  var out;
  var parser = new jsmime.MimeParser(
    {
      endMessage() {
        out.close();
      },
      startPart(jsmimePartNum, jsmimeHeaders) {
        var partNum = jsmimePartNum === "" ? "1" : "1." + jsmimePartNum;
        var headers = MimeHeaderInfo.fromJSMime(jsmimeHeaders, {
          parentContentType: partNum.includes(".")
            ? partToContentTypeMap.get(
                partNum.slice(0, partNum.lastIndexOf("."))
              )
            : null,
        });

        partToContentTypeMap.set(partNum, headers.contentType);

        var bodyStream = null;
        if (headers.mediatype !== "multipart") {
          bodyStream = new ReadableStream({
            start(controller) {
              partToStreamControllerMap.set(partNum, controller);
            },
          }).pipeThrough(new BlobTransformStream({ saveChunkSize, mimeType }));
        }

        out.enqueue({
          partNum,
          headers,
          bodyStream,
        });
      },
      endPart(jsmimePartNum) {
        var partNum = jsmimePartNum === "" ? "1" : "1." + jsmimePartNum;
        var partOut = partToStreamControllerMap.get(partNum);
        if (partOut) {
          partOut.close();
        }
      },
      deliverPartData(jsmimePartNum, data) {
        var partNum = jsmimePartNum === "" ? "1" : "1." + jsmimePartNum;
        var partOut = partToStreamControllerMap.get(partNum);
        if (partOut) {
          partOut.enqueue(data);
        }
        // TODO: Use some type of explicit logic.js-supported fault injection?
        if (MimeNodeTransformStream.TEST_ONLY_DIE_DURING_MIME_PROCESSING) {
          console.warn("*** Throwing exception in mime parsing for a test!");
          MimeNodeTransformStream.TEST_ONLY_DIE_DURING_MIME_PROCESSING = false;
          throw new Error("TEST_ONLY_DIE_DURING_MIME_PROCESSING");
        }
      },
    },
    {
      bodyformat: "decode", // Decode base64/quoted-printable for us.
      strformat: "typedarray",
      onerror: e => {
        console.error("JSMIME Parser Error:", e, "\n", e.stack);
        out.error(e);
      },
    }
  );

  // We receive data here...
  this.writable = new WritableStream({
    write(chunk) {
      parser.deliverData(mimefuncs.fromTypedArray(chunk));
    },
    abort(e) {
      // On connection death or a negative response, we abort.
      out.error(e);
    },
    close() {
      parser.deliverEOF();
    },
  });

  // We emit data here.
  this.readable = new ReadableStream({
    start(controller) {
      out = controller;
    },
  });
}

MimeNodeTransformStream.TEST_ONLY_DIE_DURING_MIME_PROCESSING = false;
