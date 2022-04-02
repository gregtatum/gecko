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

    this.workshopAPI.promisedLatestOnce("configLoaded").then(() => {
      this.requestUpdate();
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.workshopAPI.on("time-warp", this, this.onTimeWarped);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.workshopAPI.removeListener("time-warp", this, this.onTimeWarped);
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

  onTimeWarped() {
    this.requestUpdate();
  }

  setTimeWarp() {
    const input = this.renderRoot.querySelector("#home-time-warp");
    const fakeNow = new Date(input.value).valueOf();
    this.workshopAPI.TEST_timeWarp({ fakeNow });
    this.requestUpdate();
  }

  clearTimeWarp() {
    this.workshopAPI.TEST_timeWarp({ fakeNow: null });
    this.requestUpdate();
  }

  now() {
    const now = new Date();
    now.setHours(8);
    now.setMinutes(-now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
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
    let maybeWarp;
    if (this.workshopAPI.fakeNow) {
      maybeWarp = html`
        <h4>current warp: ${this.workshopAPI.now()}</h4>
      `;
    }

    return html`
      <section class="card">
        <h2>Accounts</h2>
        <awi-list-view
          .listView=${null /* this.workshopAPI.accounts */}
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
        <button id="home-download-logs" type="button" @click=${this.getLogs}>
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
      <section class="card">
        <h2>Time warp!</h2>
        ${maybeWarp}
        <label for="home-time-warp"
          >Choose a date and a time to use for now():</label
        >
        <input type="datetime-local" id="home-time-warp" value=${this.now()} />
        <button id="home-timewarp-set" type="button" @click=${this.setTimeWarp}>
          Set Time Warp
        </button>
        <button
          id="home-timewarp-clear"
          type="button"
          @click=${this.clearTimeWarp}
        >
          Clear Time Warp
        </button>
      </section>
    `;
  }
}
customElements.define("awi-homepage", HomePage);
