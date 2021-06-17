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

export default function RecipientsFilter(params, args) {
  this.searchPattern = searchPatternFromArgs(args);
}
RecipientsFilter.prototype = {
  /**
   * We don't need anything beyond the message.
   */
  gather: {
    // message is implicit to the context
  },

  /**
   * Orders of magnitude: boolean (1), string (10), honking big string (100).
   */
  cost: 20,

  /**
   * Depending on incoming/outgoing folder type, the recipients list may be
   * important for UI purposes.  We perhaps could/should parameterize this.
   */
  alwaysRun: true,

  test(gathered) {
    let searchPattern = this.searchPattern;

    function checkList(recipients) {
      if (!recipients) {
        return null;
      }
      for (let recipient of recipients) {
        if (recipient.name) {
          let matchInfo = matchVerbatimHighlight(searchPattern, recipient.name);
          if (matchInfo) {
            return matchInfo;
          }
        }

        let matchInfo = matchVerbatimHighlight(
          searchPattern,
          recipient.address
        );
        if (matchInfo) {
          return matchInfo;
        }
      }
      return null;
    }

    let message = gathered.message;
    return (
      checkList(message.to) || checkList(message.cc) || checkList(message.bcc)
    );
  },
};
