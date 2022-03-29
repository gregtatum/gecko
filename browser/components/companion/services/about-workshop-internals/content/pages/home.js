/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "../lit_glue.js";

import { Page } from "../page.js";

import "../elements/list_view.js";
import "../elements/account_list_item.js";
import { logsCollector } from "../log_collected.js";

export default class HomePage extends Page {
  constructor(opts) {
    super(opts, {
      title: "Workshop Internals Home",
      pageId: "page-home",
    });
  }

  async getLogs() {
    const buffer = await this.workshopAPI.getLogicBuffer();
    const jsonString = JSON.stringify(buffer);
    const blob = new Blob([jsonString], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "worshop_log.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async openLogs() {
    const input = document.createElement("input");
    input.type = "file";
    const promise = new Promise(resolve => {
      input.onchange = () => {
        const { files } = input;
        if (files.length === 0) {
          resolve(null);
          return;
        }
        resolve(input.files.item(0));
      };
    });
    input.click();

    const file = await promise;
    if (!file) {
      return;
    }

    const jsonString = await file.text();
    const json = JSON.parse(jsonString);
    logsCollector.loadData(json);
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 1em;
      }
    `;
  }

  render(pageElem) {
    return html`
      <section class="card">
        <h2>Accounts</h2>
        <awi-list-view
          .listView=${[] /* this.workshopAPI.accounts */}
          .factory=${account =>
            html`
              <awi-account-list-item
                .account=${account}
                .serial=${account.serial}
              ></awi-account-list-item>
            `}
        />
      </section>
      <section class="card">
        <h2>Buttons!</h2>
        <button
          id="home-show-add-account"
          type="button"
          disabled
          @click=${() => {
            this.router.navigateTo(["add"]);
          }}
        >
          Add Account
        </button>
        <button
          id="home-show-settings"
          type="button"
          @click=${() => {
            this.router.navigateTo(["settings"]);
          }}
        >
          Settings
        </button>
        <button
          id="home-show-logs"
          type="button"
          @click=${() => {
            this.router.navigateTo(["logs"]);
          }}
        >
          Live logs
        </button>
        <button
          id="home-download-logs"
          type="button"
          @click=${() => {
            this.getLogs();
          }}
        >
          Download logs
        </button>
        <button
          id="home-load-logs"
          type="button"
          @click=${async () => {
            try {
              await this.openLogs();
              this.router.navigateTo(["logs"]);
            } catch (e) {
              console.error(
                "Something went wrong when getting logs from a local file",
                e
              );
            }
          }}
        >
          Load logs
        </button>
      </section>
    `;
  }
}
customElements.define("awi-homepage", HomePage);
