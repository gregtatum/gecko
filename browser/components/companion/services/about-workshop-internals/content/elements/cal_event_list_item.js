/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, LitElement } from "../lit_glue.js";
import "./pretty_table.js";

export class CalEventListItem extends LitElement {
  static get properties() {
    return {
      event: { type: Object },
      serial: { type: Number },
    };
  }

  render() {
    const event = this.event;
    return html`
      <div class="event-header-row">
        <h4 class="event-subject">${event.subject}</h4>
      </div>
      <div class="event-wire-rep">
        <awi-pretty-table .data=${event._wireRep} />
      </div>
      <div class="event-body-parts">
        ${event.bodyReps.map(bodyRep => {
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
customElements.define("awi-event-list-item", CalEventListItem);
