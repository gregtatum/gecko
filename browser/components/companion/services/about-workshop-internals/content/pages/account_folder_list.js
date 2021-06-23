/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Page } from "../page.js";

import { ListView } from "../elements/list_view.js";
import { FolderListItem } from "../elements/folder_list_item.js";

export default class AccountFolderListPage extends Page {
  constructor(opts, { accountId }) {
    super(opts, {
      title: "Folders",
      pageId: "page-account-folder-list",
    });
    this.accountId = accountId;
  }

  async render(pageElem) {
    const account = await this.workshopAPI.accounts.eventuallyGetAccountById(
      this.accountId
    );
    const listElem = new ListView(account.folders, FolderListItem);
    pageElem.appendChild(listElem);
  }

  cleanup(pageElem) {
    pageElem.replaceChildren();
    // Note that we don't need to / shouldn't release the account's folder list
    // because it's supposed to always be there, but for other list views which
    // we ourselves created, we would want to call `release()` at the end.
  }
}
