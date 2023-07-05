/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "flowId",
  "browser.translations.telemetry.flowId"
);

/**
 * Telemetry functions for Translations actors
 */
export class TranslationsTelemetry {
  /**
   * A regex to determine a valid flowId, which conforms to UUID.
   */
  static #flowIdRegex =
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * A cached value to hold the current flowId.
   */
  static #flowId = null;

  /**
   * Forces the creation of a new Translations telemetry flowId and returns it.
   * @returns {string}
   */
  static createFlowId() {
    const flowId = crypto.randomUUID();
    TranslationsTelemetry.#flowId = flowId;
    Services.prefs.setCharPref("browser.translations.telemetry.flowId", flowId);
    return flowId;
  }

  /**
   * Returns a Translations telemetry flowId by retrieving the cached value
   * if available, or creating a new one otherwise.
   * @returns {string}
   */
  static getOrCreateFlowId() {
    // If we have the flowId cached, return it.
    if (TranslationsTelemetry.#flowId) {
      return TranslationsTelemetry.#flowId;
    }

    // If the flowId pref is a valid UUID, cache it and use it.
    if (TranslationsTelemetry.#flowIdRegex.test(lazy.flowId)) {
      TranslationsTelemetry.#flowId = lazy.flowId;
      return TranslationsTelemetry.#flowId;
    }

    // If no flowId exists, create one.
    return TranslationsTelemetry.createFlowId();
  }

  /**
   * Records a telemetry event when full page translation fails.
   *
   * @param {Error} error
   */
  static onError(error) {
    Glean.translations.errorRate.addToNumerator(1);
    Glean.translations.error.record({
      flow_id: TranslationsTelemetry.getOrCreateFlowId(),
      reason: String(error),
    });
  }

  /**
   * Records a telemetry event when a translation request is sent.
   *
   * @param {object} data
   * @param {string} data.fromLanguage
   * @param {string} data.toLanguage
   * @param {boolean} data.autoTranslate
   */
  static onTranslate(data) {
    Glean.translations.requestsCount.add(1);
    Glean.translations.translationRequest.record({
      flow_id: TranslationsTelemetry.getOrCreateFlowId(),
      from_language: data.fromLanguage,
      to_language: data.toLanguage,
      auto_translate: data.autoTranslate,
    });
  }
}
