/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, LitElement } from "../lit_glue.js";

/**
 * Monolithic breadcrumb element which takes an array describing the text to
 * display and the callbacks to invoke.  This is probably the wrong factoring,
 * especially in terms of modeling the crumbs for a11y.
 */
export class Breadcrumbs extends LitElement {
  static get properties() {
    return {
      crumbs: { type: Object },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      .crumb-container {
      }

      .crumb-item + .crumb-item:before {
        content: ">";
      }

      .crumb-item {
        display: inline-block;
      }
    `;
  }

  render() {
    return html`
      <ul class="crumb-container">
        ${this.crumbs.map((crumb, index) => {
          if (index < this.crumbs.length - 1) {
            return html`
              <li class="crumb-item">
                <a href="" @click=${crumb.click}>${crumb.label}</a>
              </li>
            `;
          }

          return html`
            <li class="crumb-item">
              ${crumb.label}
            </li>
          `;
        })}
      </ul>
    `;
  }
}
customElements.define("awi-breadcrumbs", Breadcrumbs);
