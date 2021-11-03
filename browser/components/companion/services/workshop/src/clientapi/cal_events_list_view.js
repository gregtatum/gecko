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

import { WindowedListView } from "./windowed_list_view";
import { CalEvent } from "./cal_event";

export class CalEventsListView extends WindowedListView {
  constructor(api, handle) {
    super(api, CalEvent, handle);
    this._nextSnippetRequestValidAt = 0;
  }
  /**
   * Ensure that we have snippets for all of the messages in this view.
   *
   * Includes some request suppression logic
   *
   * NB: Currently this assumes that we only display the contents of a single
   * conversation.
   * TODO: generalize to have message-centric sync_body-style logic
   */
  ensureSnippets() {
    const snippetsNeeded = this.items.some(message => {
      return message && message.snippet === null;
    });

    if (snippetsNeeded) {
      // Forbid us from making snippet requests more than once every 5 seconds.
      // We put this logic inside the snippetsNeeded guard so that we don't count
      // a case where no snippets are needed (because of lazy loading) and then
      // suppress the case where we would want to fire.
      if (this._nextSnippetRequestValidAt > Date.now()) {
        return;
      }
      this._nextSnippetRequestValidAt = Date.now() + 5000;

      // NB: We intentionally do not use a handle as there's no reason this needs
      // to be statefully associated with a list view.
      this._api.__bridgeSend({
        type: "fetchSnippets",
        convIds: [this.conversationId],
      });
    }
  }
  // XXX The conversations list view has extra mechanics around this.
  async refresh() {
    await this._api._sendPromisedRequest({
      type: "refreshView",
      handle: this.handle,
    });
  }
}
