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
 * This file defines the mapping between the searchFolderConversations
 * `spec.filter` and the classes that get instantiated.  (The values specified
 * for the keys are passed to the constructors verbatim.)  The `QueryManager`
 * uses us for this.  It then looks at the instantiated filters to derive the
 * gatherers required.
 **/
import msgFilters from './msg_filters';

import ParticipantsFilter from './filters/conversation/participants_filter';
import MessageSpreadFilter from './filters/conversation/message_spread_filter';

// The conversation specific filters.
const convFilters = {
  participants: {
    constructor: ParticipantsFilter,
    params: null
  },
};

for (let key of Object.keys(msgFilters)) {
  let msgFilterDef = msgFilters[key];
  convFilters[key] = {
    constructor: MessageSpreadFilter,
    params: { wrappedFilterDef: msgFilterDef }
  };
}

export default convFilters;
