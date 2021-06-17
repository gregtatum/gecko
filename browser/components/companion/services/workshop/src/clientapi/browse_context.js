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
 * STILL UNDER CONSIDERATION.  Trying the redux approach for now.  Partial
 * rationale is that to simplify this implementation, I would ideally not allow
 * this to be instantiated until the backend has sufficiently bootstrapped
 * enough to have sent the account and per-account folder lists in their
 * entirety.  But gaia mail, for example, generally tries to have its
 * abstractions be able to handle the backend not having been spun up at all,
 * etc.
 *
 * Captures the state of coordinated account/folder-ish/conversation/message
 * browsing and provides related helper logic.
 *
 * When reading/browsing conversations/messages, there is an inherent hierarchy
 * going on.  Because of our use of a backing database and worker, there's also
 * some inherent short-lived asynchrony going on.  If persisting UI state
 * externally and restoring it, there's also the chance for things to no longer
 * exist due to delete folders/conversations/messages.  BrowseContext attempts
 * to deal with this once for all clients.  (It is also able to almost
 * completely eliminate some asynchrony by tricks like leveraging the
 * always-existing accounts slices and their folder slices.  Cleaner consumer
 * code is likely to use the more straightforward and logically independent
 * getConversation/etc. which end up with the short-lived asynchrony problem.)
 *
 * In particular:
 *
 * - Navigation requests that involve short-lived asynchrony pretend like the
 *   request didn't happen until the short-lived asynchrony is addressed.  For
 *   example, if switching folders, we will avoid announcing the folder switch
 *   until
 */
export default function BrowseContext({ api }) {
  this._api = api;
}
BrowseContext.prototype = {
  selectAccount(account) {},

  selectAccountId(accountId) {},

  selectFolder(folder) {},

  selectFolderId(folderId) {},

  selectConversation(conversation) {},

  selectConversationId(conversationId) {},

  selectMessage(message) {},

  selectMessageId(messageId) {},
};
