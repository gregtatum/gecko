/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "../lit_glue.js";

import { Page } from "../page.js";

import "../elements/cal_event_list_item.js";
import "../elements/list_view.js";
import "../elements/message_list_item.js";

/**
 * List the messages in all account.
 */
export default class AllMessageContentsByTagPage extends Page {
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
      pageId: "page-all-message-contents-by-tag",
    });

    this.listView = null;
    this.query = query;
  }

  willUpdate(changedProperties) {
    if (this.listView) {
      this.listView.release();
      this.listView = null;
    }

    const { tag, type, durationBeforeInMinutes, kind } = this.query;
    const spec = {
      kind,
      filter: {
        tag: tag || "",
        event: {
          type: type || "now",
          durationBeforeInMinutes: durationBeforeInMinutes || 20,
        },
      },
    };

    this.listView = this.workshopAPI.searchAllMessages(spec);

    // Make sure a sync happens.
    this.listView.refresh();
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
  "awi-all-message-by-tag-page",
  AllMessageContentsByTagPage
);
