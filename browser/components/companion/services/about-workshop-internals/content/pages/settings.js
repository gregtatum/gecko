/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Page } from "../page.js";

export default class SettingsPage extends Page {
  constructor(opts) {
    super(opts, {
      title: "Workshop Settings",
      pageId: "page-settings",
    });
  }

  async render(pageElem) {
    // Wait for the configuration to have been received.
    await new Promise(resolve => {
      this.workshopAPI.latestOnce("config", resolve);
    });
    this.loggingToggle = pageElem.querySelector(
      "#settings-realtime-logging-enable"
    );

    this.loggingToggle.checked =
      this.workshopAPI.config.debugLogging === "realtime";

    this.loggingToggleHandler = () => {
      const enabled = this.loggingToggle.checked;
      console.log("Setting logging to", enabled);
      this.workshopAPI.modifyConfig({
        debugLogging: enabled ? "realtime" : null,
      });
    };
    this.loggingToggle.addEventListener("change", this.loggingToggleHandler);
  }

  cleanup() {
    this.loggingToggle.removeEventListener("change", this.loggingToggleHandler);
  }
}
