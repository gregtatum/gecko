/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "../lit_glue.js";

import { Page } from "../page.js";

import "../elements/cal_event_list_item.js";
import "../elements/list_view.js";
import "../elements/message_list_item.js";

/**
 * List the messages in an account.
 */
export default class AccountMessageContentsByTagPage extends Page {
  static get properties() {
    return {
      account: { state: true },
      accountId: { type: Number },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 1em;
      }
    `;
  }

  constructor(opts, { accountId, query }) {
    super(opts, {
      title: "Messages",
      pageId: "page-account-message-contents-by-tag",
    });

    this.accountId = accountId;
    this.account = null;
    this.listView = null;
    this.query = query;

    this.getAccount();
  }

  async getAccount() {
    this.account = await this.workshopAPI.accounts.eventuallyGetAccountById(
      this.accountId
    );
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("accountId")) {
      this.getAccount();
    }
    if (changedProperties.has("account")) {
      if (this.listView) {
        this.listView.release();
        this.listView = null;
      }
      if (!this.account) {
        return;
      }

      const { tag, type, durationBeforeInMinutes } = this.query;
      const spec = {
        account: this.account,
        filter: {
          tag: tag || "",
          event: {
            type: type || "now",
            durationBeforeInMinutes: durationBeforeInMinutes || 20,
          },
        },
      };

      this.listView = this.workshopAPI.searchAccountMessages(spec);

      // Make sure a sync happens.
      this.listView.refresh();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.listView) {
      this.listView.release();
      this.listView = null;
    }
  }

  render(pageElem) {
    return html`
      <awi-list-view
        .listView=${this.listView}
        .factory=${item => {
          if (item.type === "cal") {
            return html`
              <awi-event-list-item .event=${item} .serial=${item.serial} />
            `;
          }
          return html`
            <awi-message-list-item .message=${item} .serial=${item.serial} />
          `;
        }}
      />
    `;
  }

  cleanup(pageElem) {
    pageElem.replaceChildren();
    if (this.listView) {
      this.listView.release();
      this.listView = null;
    }
  }
}
customElements.define(
  "awi-account-message-by-tag-page",
  AccountMessageContentsByTagPage
);
