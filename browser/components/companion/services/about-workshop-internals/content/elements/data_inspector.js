/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, LitElement } from "../lit_glue.js";

import "./pretty_table.js";

export class DataInspector extends LitElement {
  static get properties() {
    return {
      data: { type: Object },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
    `;
  }

  render() {
    // Display strings and numbers in their stringified form
    if (typeof this.data !== "object") {
      return html`
        <div>${this.data}</div>
      `;
    }

    // For now show objects as pretty-tables, but this doesn't scale well for
    // deep objects, so something more like the pernosco-bridge PML view would
    // work better if still going for pretty, or JSON, or if there's an easy way
    // to embed the devtools object inspector.  A limited radio-button approach
    // that would enable picking the display and/or logging the value to the
    // console so the inspector could be used could be nice.

    return html`
      <awi-pretty-table .data=${this.data} />
    `;
  }
}
customElements.define("awi-data-inspector", DataInspector);
