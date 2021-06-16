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

import ContactCache from 'gelam/clientapi/contact_cache';

/**
 * Clean up after what we did in "conv_client_decorator.js".
 */
export default function cleanupConversation(mailConversation) {
  let tidbitPeeps = mailConversation.messageTidbits.map(x => x.author);
  ContactCache.forgetPeepInstances(tidbitPeeps);
}
