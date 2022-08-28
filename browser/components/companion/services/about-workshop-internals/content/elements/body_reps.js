/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, LitElement } from "../lit_glue.js";

export class RawTextBlob extends LitElement {
  static get properties() {
    return {
      rawText: { type: Object },
      blob: { type: Object },
    };
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("blob")) {
      this.getBlobContents();
    }
  }

  async getBlobContents() {
    this.rawText = await this.blob.text();
  }

  render() {
    return html`
      <div class="card">${this.rawText}</div>
    `;
  }
}
customElements.define("awi-raw-text-blob", RawTextBlob);

export class HtmlBodyRep extends LitElement {
  static get properties() {
    return {
      rawText: { type: Object },
      blob: { type: Object },
    };
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("blob")) {
      this.getBlobContents();
    }
  }

  async getBlobContents() {
    this.rawText = await this.blob.text();
  }

  render() {
    return html`
      <div class="card">${this.rawText}</div>
    `;
  }
}
customElements.define("awi-html-body-rep", HtmlBodyRep);
