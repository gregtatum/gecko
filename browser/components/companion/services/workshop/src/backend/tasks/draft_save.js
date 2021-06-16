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

import logic from 'logic';

import TaskDefiner from '../task_infra/task_definer';
import churnConversation from '../churn_drivers/conv_churn_driver';

import { convIdFromMessageId } from 'shared/id_conversions';

import { DESIRED_SNIPPET_LENGTH } from '../syncbase';

import { quoteProcessTextBody, generateSnippet } from '../bodies/quotechew';

/**
 * Per-account task to update the non-attachment parts of an existing draft.
 *
 * This is quite simple right now.  We just load the conversation, re-chew it,
 * and save the modified conversation and message.
 */
export default TaskDefiner.defineSimpleTask([
  {
    name: 'draft_save',

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
      let draftFields = req.draftFields;
      messageInfo.date = draftFields.date;
      messageInfo.to = draftFields.to;
      messageInfo.cc = draftFields.cc;
      messageInfo.bcc = draftFields.bcc;
      messageInfo.subject = draftFields.subject;
      // - Update the body rep
      let textRep = messageInfo.bodyReps.find((rep) => {
        return rep.type === 'plain';
      });
      textRep.contentBlob =
        new Blob([JSON.stringify([0x1, draftFields.textBody])],
                                 { type: 'application/json' });

      // - Update the snippet
      // Even though we currently store the draft body in a single block rather
      // than a fully quote-chewed representation, for snippet generation
      // purposes, it makes sense to run a quotechew pass.
      try {
        let parsedContent = quoteProcessTextBody(draftFields.textBody);
        messageInfo.snippet =
          generateSnippet(parsedContent, DESIRED_SNIPPET_LENGTH);
      } catch (ex) {
        // We don't except this to throw, but if it does, that is something we
        // want to break our unit tests.
        logic.fail(ex);
      }

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
