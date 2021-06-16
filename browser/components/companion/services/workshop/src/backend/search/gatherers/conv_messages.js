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
 * Gather the messages belonging to the provided conversation.
 *
 * The way this is used in conjunction with our gather definition, our returned
 * result of [msgA, msgB, msgC] will be exploded in the gather context to be
 * [{ message: msgA }, { message: msgB }, { message: msgC }].
 */
export default function GatherConversationMessages({ db, ctx }) {
  this._db = db;
  this._ctx = ctx;
}
GatherConversationMessages.prototype = {
  /**
   * Indicate that we return an Array of items that should be spread into their
   * own gather contexts.
   */
  plural: true,
  gather: function(gathered) {
    return this._db.read(
      this._ctx,
      {
        messagesByConversation: new Map([[gathered.convId, null]])
      })
    .then(({ messagesByConversation }) => {
      return messagesByConversation.get(gathered.convId);
    });
  }
};
