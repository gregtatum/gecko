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

import GatherConversation from './gatherers/conv';
import GatherConversationMessages from './gatherers/conv_messages';
import MessageGatherers from './msg_gatherers';

export default {
  conversation: {
    constructor: GatherConversation,
    params: null,
    nested: null
  },
  messages: {
    constructor: GatherConversationMessages,
    params: null,
    nestedRootKey: 'message',
    nested: MessageGatherers,
  },
};
