/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  // The shared TranslationsTelemetry across all of toolkit
  TranslationsTelemetry:
    "chrome://global/content/translations/TranslationsTelemetry.sys.mjs",
});

/**
 * Telemetry functions for Translations desktop UI
 */
export class TranslationsTelemetry {
  /**
   * Records a telemetry event when the translations panel is opened.
   *
   * @param {boolean} openedFromAppMenu
   */
  static onOpenPanel(openedFromAppMenu) {
    Glean.translationsPanel.open.record({
      flow_id: lazy.TranslationsTelemetry.createFlowId(),
      opened_from: openedFromAppMenu ? "appMenu" : "translationsButton",
    });
  }
}
