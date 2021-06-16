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

import matchRegexpOrString from './match_regexp_or_string';

/**
 * Use matchRegexpOrString under the hood and if we get a match, wrap it into
 * a `FilterMatchItem` with the value matched against reported verbatim.  This
 * is in contrast to matchExcerptHighlight where the entire value is believed
 * to be large and so it has to be snippeted/excerpted.
 */
export default function matchVerbatimHighlight(searchPattern, value, path) {
  var match = matchRegexpOrString(searchPattern, value, 0);
  if (!match) {
    return null;
  }
  return {
    text: value,
    offset: 0,
    matchRuns: [{ start: match.index, length: match[0].length }],
    path: path || null
  };
}

