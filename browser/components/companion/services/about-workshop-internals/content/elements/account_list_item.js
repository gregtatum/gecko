/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, LitElement } from "../lit_glue.js";

export class AccountListItem extends LitElement {
  static get properties() {
    return {
      account: { type: Object },
      serial: { type: Number },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        margin: 0.5em;
      }

      .card {
        border: 1px solid black;
        border-radius: 8px;
        padding: 1em;
      }

      .account-name {
        margin: 0;
      }

      .account-kind {
        font-family: sans-serif;
        font-weight: bold;
      }
    `;
  }

  constructor() {
    super();
  }

  render() {
    const account = this.account;

    let maybeProblems;
    if (account.problems?.length) {
      maybeProblems = html`
        <div class="account-problems">
          ${account.problems.map(problem => {
            // For now we just state the problem code, but in a production UI,
            // this would likely want to be mapped to a proper l10n id to
            // explain the problem and expose any UI needed to help rectify
            // user actionable problems.
            return html`
              <div class="account-problem">${problem}</div>
            `;
          })}
        </div>
      `;
    }

    return html`
      <div class="card">
        <div class="account-header-row">
          <h3 class="account-name">${account.name}</h3>
        </div>
        <div class="account-details-row">
          <span class="account-type">${account.type}</span>
        </div>
        <div class="account-details-row">
          <span class="account-kind">${account.kind}</span>
        </div>
        ${maybeProblems}
        <div class="account-actions-row">
          <button
            class="account-show-folders"
            type="button"
            @click=${() => {
              window.ROUTER.navigateTo(["account", account.id]);
            }}
          >
            Show Folders
          </button>
          <button
            class="account-sync-folders"
            type="button"
            @click=${() => {
              account.syncFolderList();
            }}
          >
            Sync Folders
          </button>
          <button
            class="account-re-create"
            type="button"
            @click=${() => {
              account.recreateAccount();
            }}
          >
            Re-create account
          </button>
          <button
            class="account-delete"
            type="button"
            @click=${() => {
              account.deleteAccount();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    `;
  }
}
customElements.define("awi-account-list-item", AccountListItem);
