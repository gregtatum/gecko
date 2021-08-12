/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "../lit_glue.js";

import { Page } from "../page.js";

import "../elements/list_view.js";
import "../elements/folder_list_item.js";

export default class AccountFolderListPage extends Page {
  static get properties() {
    return {
      account: { state: true },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 1em;
      }

      .card {
        border: 1px solid black;
        border-radius: 8px;
        padding: 1em;
      }
    `;
  }

  constructor(opts, { accountId }) {
    super(opts, {
      title: "Folders",
      pageId: "page-account-folder-list",
    });

    this.accountId = accountId;
    this.account = null;

    this.getAccount();
  }

  async getAccount() {
    this.account = await this.workshopAPI.accounts.eventuallyGetAccountById(
      this.accountId
    );
    this.account.syncFolderList();
  }

  render(pageElem) {
    if (!this.account) {
      return html`
        <div></div>
      `;
    }

    return html`
      <awi-list-view
        .listView=${this.account.folders}
        .factory=${folder =>
          html`
            <awi-folder-list-item .folder=${folder} .serial=${folder.serial} />
          `}
      />
    `;
  }
}
customElements.define("awi-account-folder-list-page", AccountFolderListPage);
