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

import { TextParser } from './textparser';

function arrayAppend(array1, array2) {
  var tmp = new Uint8Array(array1.byteLength + array2.byteLength);
  tmp.set(array1, 0);
  tmp.set(array2, array1.byteLength);
  return tmp;
}

/**
 * Wrapper around the textparser, accumulates buffer content and returns it as
 * part of the .complete step.
 */
export function SnippetParser(/*partDef*/) {
  TextParser.apply(this, arguments);
  this._array = null;
}
SnippetParser.prototype = {
  parse(u8array) {
    if (!this._array) {
      this._array = u8array;
    } else {
      this._array = arrayAppend(this._array, u8array);
    }

    // do some magic parsing
    TextParser.prototype.parse.apply(this, arguments);
  },

  complete() {
    var content =
      TextParser.prototype.complete.apply(this, arguments);

    content.buffer = this._array.buffer;
    return content;
  }
};
