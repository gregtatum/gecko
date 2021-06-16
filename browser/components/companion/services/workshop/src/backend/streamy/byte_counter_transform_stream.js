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

define(function(require) {
'use strict';

const streams = require('streams');

/**
 * A simple transform stream that counts the bytes passing through it,
 * exposing the count as `totalBytesRead`.
 */
return function ByteCounterTransformStream() {
  var self = this;
  var ts = new streams.TransformStream({
    transform(chunk, enqueue, done) {
      self.totalBytesRead += chunk.byteLength;
      enqueue(chunk);
      done();
    }
  });

  this.writable = ts.writable;
  this.readable = ts.readable;

  /** @member {number} */
  this.totalBytesRead = 0;
};
});
