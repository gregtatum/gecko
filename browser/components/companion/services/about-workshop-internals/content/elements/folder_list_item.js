/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, LitElement } from "../lit_glue.js";

export class FolderListItem extends LitElement {
  static get properties() {
    return {
      folder: { type: Object },
      serial: { type: Number },
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

  async handleTag(tag, command) {
    if (!tag) {
      return;
    }

    const actions = Object.create(null);
    actions[this.folder.id] = Object.create(null);
    actions[this.folder.id][command] = tag.split(/[,;]/).map(x => x.trim());

    await this.account.modifyFolder({
      actions,
    });
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
      <div class="folder-details-row">
        <b>Tags:</b><span class="folder-tags">${folder.tags.join(", ")}</span>
      </div>
      <div class="folder-actions-row">
        <button
          class="folder-show-messages"
          type="button"
          @click=${() => {
            const filter = this.renderRoot.querySelector(".folder-filter")
              .value;
            window.ROUTER.navigateRelative(["folder", folder.id], { filter });
          }}
        >
          Show Messages
        </button>
        <input class="folder-filter" type="text" />
      </div>
      <div class="folder-actions-row">
        <button
          class="folder-add-tag"
          type="button"
          @click=${() => {
            const el = this.renderRoot.querySelector(".folder-addtag");
            const tag = el.value;
            el.value = "";
            this.handleTag(tag, "addtag");
          }}
        >
          Add Tag
        </button>
        <input class="folder-addtag" type="text" />
      </div>
      <div class="folder-actions-row">
        <button
          class="folder-rm-tag"
          type="button"
          @click=${() => {
            const el = this.renderRoot.querySelector(".folder-rmtag");
            const tag = el.value;
            el.value = "";
            this.handleTag(tag, "rmtag");
          }}
        >
          Remove Tag
        </button>
        <input class="folder-rmtag" type="text" />
      </div>
    `;
  }
}
customElements.define("awi-folder-list-item", FolderListItem);
