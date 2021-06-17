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

 import { ReadableStream, WritableStream } from 'streams';
 import { concatBuffers } from 'shared/util';

/**
 * A stream that transforms a byte-chunk stream into a stream that emits lines.
 * Partial lines (e.g. if the stream is closed) will not be returned.
 */
export default function LineTransformStream() {
  var c; // the readable controller

  var CR = 13;
  var LF = 10;

  // Partial lines will be stored here (null if there is no partial line).
  var partialLineBuffer = null;

  // Data comes in as chunks of bytes, so we buffer it...
  this.writable = new WritableStream({
    write(chunk) {
      if (partialLineBuffer) {
        chunk = concatBuffers(partialLineBuffer, chunk);
        partialLineBuffer = null;
      }
      var lastEndIndex = 0;
      for (var i = 0; i < chunk.length - 1; i++) {
        if (chunk[i] === CR && chunk[i + 1] === LF) {
          c.enqueue(chunk.subarray(lastEndIndex, i + 2));
          lastEndIndex = i + 2;
          i++; // Advance to the LF.
        }
      }
      // If there was any data left over, store it in the buffer.
      if (lastEndIndex < chunk.length) {
        partialLineBuffer = chunk.subarray(lastEndIndex);
      }
    },

    close() {
      console.log('CLOSE writable linestream');
      c.close();
    }
  });

  // Data goes out as lines from here.
  this.readable = new ReadableStream({
    start(controller) {
      c = controller;
    }
  });
};

