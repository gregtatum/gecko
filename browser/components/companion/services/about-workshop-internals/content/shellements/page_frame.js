/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, LitElement } from "../lit_glue.js";

import "./breadcrumbs.js";
import "./splitter.js";

/**
 * Persistent page frame widget which expects and received changed pages
 * provided by the router, providing:
 * - A navigation crumb mechanism along the top.
 * - The main page body.
 * - A inspector sidebar
 */
export class PageFrame extends LitElement {
  static get properties() {
    return {
      crumbs: { type: Object },
      page: { type: Object },
      inspected: { type: Object },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        overflow: hidden;
        height: 100%;
        width: 100%;
      }

      #main-area {
        display: flex;
        flex-direction: column;
      }

      #crumbs {
      }

      #page {
        overflow: auto;
      }

      #sidebar {
        overflow: auto;
      }
    `;
  }

  render() {
    return html`
      <awi-splitter flex="left" initial="400">
        <div id="main-area" slot="left">
          <div id="crumbs">
            <awi-breadcrumbs .crumbs=${this.crumbs} />
          </div>
          <div id="page">
            ${this.page}
          </div>
        </div>
        <div id="inspector" slot="right">
          ${this.inspected}
        </div>
      </awi-splitter>
    `;
  }
}
customElements.define("awi-page-frame", PageFrame);
