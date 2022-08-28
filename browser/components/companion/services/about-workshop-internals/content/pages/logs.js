/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "../lit_glue.js";

import { Page } from "../page.js";
import "../elements/log_container.js";
import { logsCollector } from "../log_collected.js";

export default class LogsPage extends Page {
  static get styles() {
    return css`
      :host {
        display: block;
      }
    `;
  }

  constructor(opts) {
    super(opts, {
      title: "Logs",
      pageId: "page-logs",
    });
    logsCollector.setWorkshop(this.workshopAPI);
  }

  render(pageElem) {
    return html`
      <log-container .collector=${logsCollector} />
    `;
  }
}
customElements.define("awi-logs-page", LogsPage);
