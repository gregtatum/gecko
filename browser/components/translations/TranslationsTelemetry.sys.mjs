/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Telemetry functions for Translations desktop UI
 */
export class TranslationsTelemetry {
  /**
   * Records a telemetry event when the translations panel is opened.
   *
   * @param {TranslationsParent | TranslationsChild} translationsActor
   * @param {boolean} openedFromAppMenu
   */
  static async onOpenPanel(translationsActor, openedFromAppMenu) {
    Glean.translationsPanel.open.record({
      flow_id: await translationsActor.createFlowId(),
      opened_from: openedFromAppMenu ? "appMenu" : "translationsButton",
    });
  }
}
