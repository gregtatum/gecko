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

import searchPatternFromArgs from "../search_pattern_from_args";
import matchExcerptHighlight from "../../match_excerpt_highlight";

export default function SubjectFilter(params, args) {
  this.excerptSettings = params.excerptSettings;
  this.searchPattern = searchPatternFromArgs(args);
}
SubjectFilter.prototype = {
  /**
   * We don't need anything beyond what's already provided on messages.
   */
  gather: {
    // message is implicit to the context
  },

  /**
   * Orders of magnitude: boolean (1), string (10), honking big string (100).
   */
  cost: 10,

  /**
   * Everyone wants a highlighted matching subject snippet!
   */
  alwaysRun: true,

  test(gathered) {
    return matchExcerptHighlight(
      this.searchPattern,
      gathered.message.subject,
      null,
      this.excerptSettings
    );
  },
};
