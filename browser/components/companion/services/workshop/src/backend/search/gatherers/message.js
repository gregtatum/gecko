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
 * Fetch a message give its `messageId` and `date`.  Used as a root/bootstrap
 * gatherer, see `msg_gatherers.js` for more details.
 */
export default function GatherMessage({ db, ctx }) {
  this._db = db;
  this._ctx = ctx;
}
GatherMessage.prototype = {
  plural: false,
  gather(gathered) {
    // In the event the message isn't in the cache, its date is required.
    let messageKey = [gathered.messageId, gathered.date];
    return this._db
      .read(this._ctx, {
        messages: new Map([[messageKey, null]]),
      })
      .then(({ messages }) => {
        return messages.get(gathered.messageId);
      });
  },
};
