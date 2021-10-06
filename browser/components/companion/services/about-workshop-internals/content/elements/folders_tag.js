/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, LitElement } from "../lit_glue.js";

export class FoldersTag extends LitElement {
  static get properties() {
    return {
      account: { type: Object },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        border: 1px solid black;
        border-radius: 8px;
        padding: 1em;
        margin: 0.5em;
      }

      .folder-name {
        margin: 0;
      }
    `;
  }

  render() {
    const account = this.account;
    return html`
      <div>
        <div>
          <label>
            Filter by tags
            <input class="account-tag" type="text" />
          </label>
        </div>
        <div>
          <label>
            Type (now or browse)
            <input class="account-type" type="text" />
          </label>
        </div>
        <div>
          <label>
            Duration before now (in minutes)
            <input class="account-duration" type="number" />
          </label>
        </div>
        <div>
          <label>
            Account kind (to search all)
            <input class="account-kind" value="calendar" />
          </label>
        </div>
        <div class="folder-actions-row">
          <button
            class="folder-show-messages"
            type="button"
            @click=${() => {
              const tag = this.renderRoot.querySelector(".account-tag").value;
              const type = this.renderRoot.querySelector(".account-type").value;
              const durationBeforeInMinutes = this.renderRoot.querySelector(
                ".account-duration"
              ).value;
              const filter = { tag, type, durationBeforeInMinutes };
              window.ROUTER.navigateRelative(["tag", account.id], filter);
            }}
          >
            Show Messages
          </button>
          <button
            class="folder-show-all-messages"
            type="button"
            @click=${() => {
              const tag = this.renderRoot.querySelector(".account-tag").value;
              const type = this.renderRoot.querySelector(".account-type").value;
              const durationBeforeInMinutes = this.renderRoot.querySelector(
                ".account-duration"
              ).value;
              const kind = this.renderRoot.querySelector(".account-kind").value;
              const filter = { tag, type, durationBeforeInMinutes, kind };
              window.ROUTER.navigateRelative(["tag-all"], filter);
            }}
          >
            Show All Messages
          </button>
        </div>
      </div>
    `;
  }
}
customElements.define("awi-folders-tag", FoldersTag);
