/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, LitElement } from "../lit_glue.js";
import "./pretty_table.js";

export class MessageListItem extends LitElement {
  static get properties() {
    return {
      message: { type: Object },
      serial: { type: Number },
    };
  }

  constructor() {
    super();
  }

  render() {
    const message = this.message;
    return html`
      <div class="message-header-row">
        <h4 class="message-subject">${message.subject}</h4>
      </div>
      <div class="message-wire-rep">
        <awi-pretty-table .data=${message._wireRep} />
      </div>
      <div class="message-body-parts">
        ${message.bodyReps.map(bodyRep => {
          if (bodyRep.type === "html") {
            return html`
              <awi-raw-text-blob .blob=${bodyRep.contentBlob} />
            `;
          }
          return html`
            <awi-pretty-table .jsonBlob=${bodyRep.contentBlob} />
          `;
        })}
      </div>
    `;
  }
}
customElements.define("awi-message-list-item", MessageListItem);
