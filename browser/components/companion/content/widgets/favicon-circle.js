/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "../widget-utils.js";
import { css, html } from "../lit.all.js";

export class FaviconCircle extends MozLitElement {
  static get properties() {
    return {
      src: { type: String },
    };
  }

  static get styles() {
    return css`
      :host {
        display: inline-flex;
        padding: 8px;
        border: 1px solid var(--favicon-circle-border-color, ButtonText);
        background-color: var(--favicon-circle-bgcolor, ButtonFace);
        border-radius: 500px;
        box-sizing: border-box;
      }

      img {
        height: 16px;
        width: 16px;
      }
    `;
  }

  constructor() {
    super();
    this.src = "";
  }

  render() {
    return html`
      <img src="${this.src}" role="presentation" />
    `;
  }
}

customElements.define("favicon-circle", FaviconCircle);
