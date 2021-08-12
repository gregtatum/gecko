/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "../lit_glue.js";

import { Page } from "../page.js";

export default class SettingsPage extends Page {
  static get properties() {
    return {
      // The config isn't guaranteed to be available immediately, so we make
      // this a reactive property that `getConfig` populates.
      config: { state: true },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 1em;
      }
    `;
  }

  constructor(opts) {
    super(opts, {
      title: "Workshop Settings",
      pageId: "page-settings",
    });

    this.getConfig();
  }

  /**
   * Asynchronously ensure we populate `this.config` which will trigger a
   * re-render if this happens after our initial render via reactive prop.
   */
  async getConfig() {
    this.config = null;

    // Wait for the configuration to have been received.
    await new Promise(resolve => {
      this.workshopAPI.latestOnce("config", resolve);
    });
    this.config = this.workshopAPI.config;
  }

  onLoggingToggle(evt) {
    const enabled = evt.target;
    console.log("Setting logging to", enabled);
    this.workshopAPI.modifyConfig({
      debugLogging: enabled ? "realtime" : null,
    });
  }

  render() {
    if (!this.config) {
      return html`
        <h3>Loading Config...</h3>
      `;
    }

    return html`
      <form>
        <label>Realtime Logging to stdout: </label>
        <input
          id="settings-realtime-logging-enable"
          type="checkbox"
          ?checked=${this.workshopAPI.config.debugLogging === "realtime"}
          @change=${this.onLoggingToggle}
        />
      </form>
    `;
  }
}
customElements.define("awi-settings-page", SettingsPage);
