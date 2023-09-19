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
   * @type {Map<InnerWindowID, TranslationsParent | AboutTranslationsParent>}
   */
  #translationsParents = new Map();

  async receiveMessage({ name, data }) {
    switch (name) {
      case "TranslationsEngine:RequestEnginePayload": {
        const { fromLanguage, toLanguage } = data;
        const payloadPromise =
          lazy.TranslationsParent.getTranslationsEnginePayload(
            fromLanguage,
            toLanguage
          );
        payloadPromise.catch(error => {
          lazy.TranslationsParent.telemetry().onError(String(error));
        });
        return payloadPromise;
      }
      case "TranslationsEngine:ReportEngineStatus": {
        const { innerWindowId, status } = data;
        const translationsParent = this.#translationsParents.get(innerWindowId);

        // about:translations will not have a TranslationsParent associated with
        // this call.
        if (translationsParent) {
          switch (status) {
            case "ready":
              translationsParent.languageState.isEngineReady = true;
              break;
            case "error":
              translationsParent.languageState.error = "engine-load-failure";
              break;
            default:
              throw new Error("Unknown engine status: " + status);
          }
        }
        return undefined;
      }
      case "TranslationsEngine:DestroyEngineProcess":
        ChromeUtils.addProfilerMarker(
          "TranslationsEngine",
          {},
          "Loading bergamot wasm array buffer"
        );
        lazy.TranslationsParent.destroyEngineProcess().catch(error =>
          console.error(error)
        );
        return undefined;
      default:
        return undefined;
    }
  }

  constructor() {
    super();
  }

  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {number} innerWindowId
   * @param {MessagePort} port
   * @param {number} innerWindowId
   * @param {TranslationsParent} [translationsParent]
   */
  startTranslation(
    fromLanguage,
    toLanguage,
    port,
    innerWindowId,
    translationsParent
  ) {
    if (translationsParent) {
      this.#translationsParents.set(
        translationsParent.innerWindowId,
        translationsParent
      );
    }
    if (this.#isDestroyed) {
      throw new Error("The translation engine process was already destroyed.");
    }
    this.sendAsyncMessage(
      "TranslationsEngine:StartTranslation",
      {
        fromLanguage,
        toLanguage,
        innerWindowId,
        port,
      },
      [port]
    );
  }

  /**
   * Remove all the translations that are currently queued.
   *
   * @param {number} innerWindowId
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {boolean} closePort - Close the MessagePort as well.
   */
  discardTranslations(innerWindowId, fromLanguage, toLanguage, closePort) {
    this.#translationsParents.delete(innerWindowId);
    this.sendAsyncMessage("TranslationsEngine:DiscardTranslations", {
      innerWindowId,
      fromLanguage,
      toLanguage,
      closePort,
    });
  }

  #isDestroyed = false;

  didDestroy() {
    this.#isDestroyed = true;
  }
}
