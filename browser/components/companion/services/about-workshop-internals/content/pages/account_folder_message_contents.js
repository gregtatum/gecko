/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ListView } from "../elements/list_view.js";
import { MessageListItem } from "../elements/message_list_item.js";
import { Page } from "../page.js";

export default class AccountFolderMessageContentsPage extends Page {
  constructor(opts, { folderId }) {
    super(opts, {
      title: "Messages",
      pageId: "page-account-folder-message-contents",
    });

    this.folderId = folderId;
    this.listView = null;
  }

  async render(pageElem) {
    const folder = await this.workshopAPI.eventuallyGetFolderById(
      this.folderId
    );
    this.listView = this.workshopAPI.viewFolderMessages(folder);
    // Make sure a sync happens.
    this.listView.refresh();
    const listElem = new ListView(this.listView, MessageListItem);
    pageElem.appendChild(listElem);
  }

  cleanup(pageElem) {
    pageElem.replaceChildren();
    this.listView.release();
    this.listView = null;
  }
}
