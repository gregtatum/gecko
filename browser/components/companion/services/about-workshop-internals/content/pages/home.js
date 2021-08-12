/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "../lit_glue.js";

import { Page } from "../page.js";

import "../elements/list_view.js";
import "../elements/account_list_item.js";

export default class HomePage extends Page {
  constructor(opts) {
    super(opts, {
      title: "Workshop Internals Home",
      pageId: "page-home",
    });
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 1em;
      }
    `;
  }

  render(pageElem) {
    return html`
      <section class="card">
        <h2>Accounts</h2>
        <awi-list-view
          .listView=${this.workshopAPI.accounts}
          .factory=${account =>
            html`
              <awi-account-list-item
                .account=${account}
                .serial=${account.serial}
              ></awi-account-list-item>
            `}
        />
      </section>
      <section class="card">
        <h2>Buttons!</h2>
        <button
          id="home-show-add-account"
          type="button"
          @click=${() => {
            this.router.navigateTo(["add"]);
          }}
        >
          Add Account
        </button>
        <button
          id="home-show-settings"
          type="button"
          @click=${() => {
            this.router.navigateTo(["settings"]);
          }}
        >
          Settings
        </button>
        <button
          id="home-show-logs"
          type="button"
          @click=${() => {
            this.router.navigateTo(["logs"]);
          }}
        >
          Logs
        </button>
      </section>
    `;
  }
}
customElements.define("awi-homepage", HomePage);
