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

/**
 * Check if a string or a regexp matches an input and if it does, it returns a
 * 'return value' as RegExp.exec does.  Note that the 'index' of the returned
 * value will be relative to the provided `fromIndex` as if the string had been
 * sliced using fromIndex.
 */
export default function matchRegexpOrString(phrase, input, fromIndex) {
  if (!input) {
    return null;
  }

  if (phrase instanceof RegExp) {
    return phrase.exec(fromIndex ? input.slice(fromIndex) : input);
  }
  // TODO: Eliminate the string code-path and naming.  We probably do want to
  // keep the slightly abstract concept of search pattern since it could let us
  // do some higher level string matching that is beyond regexps but without us
  // having to do indexOf all over the place.

  var idx = input.indexOf(phrase, fromIndex);
  if (idx === -1) {
    return null;
  }

  var ret = [ phrase ];
  ret.index = idx - fromIndex;
  return ret;
}
