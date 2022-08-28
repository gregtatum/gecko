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
import matchVerbatimHighlight from "../../match_verbatim_highlight";

/**
 * Like the per-message Author filter but we check the ConversationInfo authors
 * aggregate list instead of the messages.  This inherently involves less data
 * but also fails to check replyTo.  Also, if we're already gathering the
 * messages for any of the other filters, this is potentially less efficient.
 * If we address the replyTo implications, it could make sense to rename this
 * back to author filter and have it hide the per-message one in the
 * conversation case.
 */
export default function ParticipantsFilter(params, args) {
  this.searchPattern = searchPatternFromArgs(args);
}
ParticipantsFilter.prototype = {
  /**
   * We check authors directly on the conversation since an aggregate is
   * explicitly maintained.  The conversation is implicit, so we don't request
   * anything additional.
   */
  gather: {
    conversation: true,
  },

  /**
   * Orders of magnitude: boolean (1), string (10), honking big string (100).
   */
  cost: 10,

  /**
   * Everyone always wants to see highlights in matching authors!
   */
  alwaysRun: true,

  test(gathered) {
    let searchPattern = this.searchPattern;

    for (let author of gathered.conversation.authors) {
      if (author.name) {
        let matchInfo = matchVerbatimHighlight(searchPattern, author.name);
        if (matchInfo) {
          return matchInfo;
        }
      }

      let matchInfo = matchVerbatimHighlight(searchPattern, author.address);
      if (matchInfo) {
        return matchInfo;
      }
    }

    return null;
  },
};
