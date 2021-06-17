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

import GatherMessage from "./gatherers/message";
import GatherMessageBodies from "./gatherers/message/message_bodies";
import AuthorDomain from "./gatherers/message/author_domain";
import DaysAgo from "./gatherers/message/days_ago";

export default {
  /**
   * Gathers message given messageId, but this never needs to be specified as
   * a gather path by filters/friends.  It's harmless if specified, but in a
   * case where this wasn't already provided for by the context, the
   * data-ordering is certain to cause failures.
   *
   * In the message context case, this will be specified as the bootstrapKey and
   * so automatically used.  Explicit mentions of it are idempotently moot at
   * gather hierarchy build time since the key will already match.
   *
   * In the conversations "messages" case, the "conv_messages" gatherer will
   * have provided the "message" object directly into the context already.  In
   * that case this gatherer will be added but will be inhibited from running
   * by the key already being present in the "gatherInto".
   */
  message: {
    constructor: GatherMessage,
    params: null,
    nested: null,
  },
  bodyContents: {
    constructor: GatherMessageBodies,
    params: null,
    nested: null,
  },

  //////////////////////////////////////////////////////////////////////////////
  // Computed Gatherers
  //
  //
  authorDomain: {
    constructor: AuthorDomain,
    params: null,
    nested: null,
  },
  daysAgo: {
    constructor: DaysAgo,
    params: null,
    nested: null,
  },
};
