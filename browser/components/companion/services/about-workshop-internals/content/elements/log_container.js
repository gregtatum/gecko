/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, repeat, LitElement } from "../lit_glue.js";
// Ensure `log-event` custom event is registered
import "./log_event.js";

export class LogContainer extends LitElement {
  static get properties() {
    return {
      collector: { type: Object },
      serial: { state: true },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      .EventList {
        padding: 0 1em 1em 1em;
        font: 12px Helvetica, sans-serif;
      }
    `;
  }

  constructor() {
    super();
    this.serial = 0;
  }

  connectedCallback() {
    super.connectedCallback();
    this.collector.attachListener(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.collector.detachListener(this);
  }

  logsUpdated() {
    // modifying the reactive (property) "state" schedules a re-render
    this.serial = this.collector.serial;
  }

  render() {
    return html`
      <div class="EventList">
        ${repeat(
          this.collector.entries,
          event => event.guid,
          event =>
            html`
              <log-event .event=${event} />
            `
        )}
      </div>
    `;
  }
}
customElements.define("log-container", LogContainer);
