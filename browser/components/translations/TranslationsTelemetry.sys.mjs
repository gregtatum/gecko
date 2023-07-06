/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Telemetry functions for Translations desktop UI
 */
export class TranslationsTelemetry {
  /**
   * @param {string} flowId - TODO DOCS
   */
  constructor(flowId) {
    this.flowId = flowId;
  }

  /**
   * Records a telemetry event when the translations panel is opened.
   *
   * @param {boolean} openedFromAppMenu
   */
  onOpenPanel(openedFromAppMenu) {
    if (!this.flow_id) {
      throw new Error("No flow id was provided (explain constraints more).");
    }
    Glean.translationsPanel.open.record({
      flow_id: this.flow_id,
      opened_from: openedFromAppMenu ? "appMenu" : "translationsButton",
    });
  }
}
