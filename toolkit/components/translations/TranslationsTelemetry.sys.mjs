/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Telemetry functions for Translations actors
 */
export class TranslationsTelemetry {
  /**
   * Records a telemetry event when full page translation fails.
   *
   * @param {TranslationsParent | TranslationsChild} translationsActor
   * @param {Error} error
   */
  static async onError(translationsActor, error) {
    Glean.translations.errorRate.addToNumerator(1);
    Glean.translations.error.record({
      flow_id: await translationsActor.getOrCreateFlowId(),
      reason: String(error),
    });
  }

  /**
   * Records a telemetry event when a translation request is sent.
   *
   * @param {TranslationsParent | TranslationsChild} translationsActor
   * @param {object} data
   * @param {string} data.fromLanguage
   * @param {string} data.toLanguage
   * @param {boolean} data.autoTranslate
   */
  static async onTranslate(translationsActor, data) {
    Glean.translations.requestsCount.add(1);
    Glean.translations.translationRequest.record({
      flow_id: await translationsActor.getOrCreateFlowId(),
      from_language: data.fromLanguage,
      to_language: data.toLanguage,
      auto_translate: data.autoTranslate,
    });
  }
}
