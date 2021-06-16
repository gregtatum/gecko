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

import TaskDefiner from '../task_infra/task_definer';
import churnConversation from '../churn_drivers/conv_churn_driver';

import { convIdFromMessageId } from 'shared/id_conversions';

/**
 * Per-account task to remove an attachment from a draft.  This is trivial and
 * very similar to saving a draft, so will likely be consolidated.
 */
export default TaskDefiner.defineSimpleTask([
  {
    name: 'draft_detach',

    async plan(ctx, req) {
      let { messageId } = req;
      let convId = convIdFromMessageId(messageId);
      let fromDb = await ctx.beginMutate({
        conversations: new Map([[convId, null]]),
        messagesByConversation: new Map([[convId, null]])
      });

      let messages = fromDb.messagesByConversation.get(convId);
      let modifiedMessagesMap = new Map();

      let messageInfo = messages.find(msg => msg.id === messageId);
      if (messageInfo === null) {
        throw new Error('moot');
      }

      // -- Update the message.
      let attachmentIndex =
        messageInfo.attachments.findIndex(
          att => att.relId === req.attachmentRelId);
      if (attachmentIndex === -1) {
        throw new Error('moot');
      }
      messageInfo.attachments.splice(attachmentIndex, 1);
      messageInfo.hasAttachments = messageInfo.attachments.length > 0;
      modifiedMessagesMap.set(messageId, messageInfo);

      let oldConvInfo = fromDb.conversations.get(req.convId);
      let convInfo = churnConversation(convId, oldConvInfo, messages);

      await ctx.finishTask({
        mutations: {
          conversations: new Map([[convId, convInfo]]),
          messages: modifiedMessagesMap
        }
      });
    },

    execute: null
  }
]);
