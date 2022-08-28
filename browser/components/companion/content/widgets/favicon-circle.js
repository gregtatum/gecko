/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "../widget-utils.js";
import { css, html } from "../lit.all.js";

export class FaviconCircle extends MozLitElement {
  static get properties() {
    return {
      src: { type: String },
      size: { type: String },
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

      img[size=""],
      img[size="medium"] {
        height: 16px;
        width: 16px;
        border-radius: 2px;
      }

      img[size="large"] {
        height: 28px;
        width: 28px;
        border-radius: 4px;
      }

      img[src=""] {
        visibility: hidden;
      }
    `;
  }

  constructor() {
    super();
    this.src = "";
    this.size = "medium";
  }

  render() {
    return html`
      <img src="${this.src}" role="presentation" alt="" size=${this.size} />
    `;
  }
}

customElements.define("favicon-circle", FaviconCircle);
