/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The translations engine is in its own content process. This actor handles the
 * marshalling of the data such as the engine payload and port passing.
 */
export class TranslationsEngineParent extends JSWindowActorParent {
  /**
   * Keep track of translations with an ID.
   */
  static #nextTranslationId = 0;

  async receiveMessage({ name, data }) {
    switch (name) {
      case "Translations:GetTranslationsEnginePayload": {
        const { fromLanguage, toLanguage } = data;
        return TranslationsParent.getTranslationsEnginePayload(
          fromLanguage,
          toLanguage
        );
      }
      default:
    }
  }

  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {MessagePort} port
   * @returns {number} translationsId
   */
  startTranslation(fromLanguage, toLanguage, port) {
    const translationsId = TranslationsEngineParent.#nextTranslationId++;
    this.sendAsyncMessage("TranslationsEngine:StartTranslation", {
      fromLanguage,
      toLanguage,
      port,
      translationsId,
    });

    return translationsId;
  }

  endTranslation(translationsId) {
    this.sendAsyncMessage("TranslationsEngine:EndTranslation", {
      translationsId,
    });
  }
}
