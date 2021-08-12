/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, LitElement } from "../lit_glue.js";

export class FolderListItem extends LitElement {
  static get properties() {
    return {
      folder: { type: Object },
      serial: { type: Number },
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
    const folder = this.folder;
    return html`
      <div class="folder-header-row">
        <h4 class="folder-name">${folder.name}</h4>
      </div>
      <div class="folder-details-row">
        <span class="folder-type">${folder.type}</span>
      </div>
      <div class="folder-actions-row">
        <button
          class="folder-show-messages"
          type="button"
          @click=${() => {
            window.ROUTER.navigateRelative(["folder", folder.id]);
          }}
        >
          Show Messages
        </button>
      </div>
    `;
  }
}
customElements.define("awi-folder-list-item", FolderListItem);
