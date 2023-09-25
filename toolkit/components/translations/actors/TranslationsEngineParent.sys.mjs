/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  TranslationsParent: "resource://gre/actors/TranslationsParent.sys.mjs",
});

/**
 * The translations engine is in its own content process. This actor handles the
 * marshalling of the data such as the engine payload and port passing.
 */
export class TranslationsEngineParent extends JSWindowActorParent {
  /**
   * Keep track of the live actors by InnerWindowID.
   *
   * @type {Map<InnerWindowID, TranslationsParent>}
   */
  #translationsParents = new Map();

  async receiveMessage({ name, data }) {
    switch (name) {
      case "TranslationsEngine:RequestEnginePayload": {
        const { fromLanguage, toLanguage } = data;
        return lazy.TranslationsParent.getTranslationsEnginePayload(
          fromLanguage,
          toLanguage
        );
      }
      case "TranslationsEngine:ReportEngineIsReady":
        const { innerWindowId } = data;
        const translationsParent = this.#translationsParents.get(innerWindowId);
        if (!translationsParent) {
          throw new Error(
            "Unable to find the translations parent from the innerWindowId: " +
              innerWindowId
          );
        }
        translationsParent.languageState.isEngineReady = true;
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * @param {TranslationsParent} translationsParent
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {number} innerWindowId
   * @param {MessagePort} port
   */
  startTranslation(translationsParent, fromLanguage, toLanguage, port) {
    this.#translationsParents.set(
      translationsParent.innerWindowId,
      translationsParent
    );
    this.sendAsyncMessage(
      "TranslationsEngine:StartTranslation",
      {
        fromLanguage,
        toLanguage,
        innerWindowId: translationsParent.innerWindowId,
        port,
      },
      [port]
    );
  }

  /**
   * @param {number} innerWindowId
   */
  endTranslation(innerWindowId) {
    this.#translationsParents.delete(innerWindowId);
    this.sendAsyncMessage("TranslationsEngine:EndTranslation", {
      innerWindowId,
    });
  }
}
