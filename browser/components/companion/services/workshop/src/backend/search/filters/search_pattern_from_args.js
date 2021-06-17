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
 * Taken from the ECMAScript proposal polyfill in the repo:
 * https://github.com/benjamingr/RegExp.escape
 * git commit: de7b32f9f72d15f9d580119963139d1027c46bbe
 * Copyright CC0 1.0 Universal Benjamin Gruenbaum 2015
 */

function regExpEscape(str) {
  return str.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Given a filter's args object that could be any of many things (but probably
 * a string), return a search pattern thing that our matcher helpers understand.
 *
 * We now upconvert the search pattern to a case-insensitive regexp if it was
 * a string.  Explicitly providing a RegExp was always possible and indeed was
 * what gaia mail did.
 *
 * @param args
 * @param opts
 * @param Boolean [opts.exact=false]
 *   Should this require an exact, albeit case-insensitive match?
 */
export default function searchPatternFromArgs(args, opts) {
  let phrase;
  if (!opts) {
    opts = {};
  }
  if ((typeof(args) === 'string') || (args instanceof RegExp)) {
    phrase = args;
  }
  else if (args && args.phrase) {
    phrase = args.phrase;
  }
  else {
    throw new Error('unable to figure out a search pattern from the args');
  }

  if (typeof(phrase) === 'string') {
    let pattern = regExpEscape(phrase);
    if (opts.exact) {
      pattern = '^' + pattern + '$';
    }
    return new RegExp(pattern, 'i');
  } else {
    return phrase;
  }
};
