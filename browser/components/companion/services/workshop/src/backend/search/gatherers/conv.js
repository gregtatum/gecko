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
 * Gather the ConversationInfo for the given conversation.
 */
export default function GatherConversation({ db, ctx }) {
  this._db = db;
  this._ctx = ctx;
}
GatherConversation.prototype = {
  gather: function(gathered) {
    return this._db.read(
      this._ctx,
      {
        conversations: new Map([[gathered.convId, null]])
      })
    .then(({ conversations }) => {
      return conversations.get(gathered.convId);
    });
  }
};
