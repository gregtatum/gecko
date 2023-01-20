/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

/**
 * The translations worker encapsulates the logic for translating messages. It can
 * only be set up for a single language translation pair. In order to change language
 * a new worker should be constructed.
 */
class TranslationsWorker {
  #messageGeneration = 0;

  /**
   * Construct and initialize the worker.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param
   */
  constructor(
    fromLanguage,
    toLanguage,
    bergmotWasmArrayBuffer,
    languageModels
  ) {
    /** @type {string} */
    this.fromLanguage = fromLanguage;
    /** @type {string} */
    this.toLanguage = toLanguage;
    /** @type {Worker} */
    this.worker = new Worker("chrome://global/content/translations/worker.js");

    /** @type {Promise<void>} */
    this.isReady = new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        lazy.console.log(
          "TranslationsWorker received an initialization message",
          data.type
        );
        if (data.type === "initialization-success") {
          resolve();
        } else if (data.type === "initialization-failure") {
          reject(data.error);
        }
        this.worker.removeEventListener("message", onMessage);
      };
      this.worker.addEventListener("message", onMessage);
    });

    this.worker.postMessage({
      type: "initialize",
      fromLanguage,
      toLanguage,
      bergmotWasmArrayBuffer,
      languageModels,
    });
  }

  /**
   * @param {string[]} messageBatch
   * @returns {Promise<string>}
   */
  translate(messageBatch) {
    const generation = this.#messageGeneration++;

    return new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        console.log("Received message", data);
        if (data.generation !== generation) {
          // This message was for someone else.
          return;
        }
        if (data.type === "translation-response") {
          resolve(data.translations);
        }
        if (data.type === "translation-error") {
          reject(data.error);
        }
        this.worker.removeEventListener("message", onMessage);
      };

      this.worker.addEventListener("message", onMessage);

      this.worker.postMessage({
        type: "translation-request",
        messageBatch,
        generation,
      });
    });
  }
}

/**
 * TODO - The translations actor will eventually be used to handle in-page translations
 * See Bug 971044
 */
export class TranslationsChild extends JSWindowActorChild {
  /**
   * The data for the Bergamot translation engine is downloaded from Remote Settings
   * and cached to disk. It is retained here in child process in case the translation
   * language switches.
   *
   * @type {ArrayBuffer | null}
   */
  #bergmotWasmArrayBuffer = null;

  /**
   * @returns {Promise<ArrayBuffer>}
   */
  async #getBergmotWasmArrayBuffer() {
    let arrayBuffer = this.#bergmotWasmArrayBuffer;
    if (!arrayBuffer) {
      arrayBuffer = await this.sendQuery(
        "Translations:GetBergmotWasmArrayBuffer"
      );
      this.#bergmotWasmArrayBuffer = arrayBuffer;
    }
    return arrayBuffer;
  }

  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {Promise<any>}
   */
  async #getTranslationModels(fromLanguage, toLanguage) {
    return this.sendQuery("Translations:GetTranslationModels", {
      fromLanguage,
      toLanguage,
    });
  }

  /**
   * @param {{ type: string }} event
   */
  handleEvent(event) {
    // TODO
    lazy.console.log("TranslationsChild observed a pageshow event.");
  }

  /**
   * Create a translations worker. It is only valid for a single language pair. If
   * a different language pair is needed, then create a new worker.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {Promise<TranslationsWorker>}
   */
  async getTranslationsWorker(fromLanguage, toLanguage) {
    const worker = new TranslationsWorker(
      fromLanguage,
      toLanguage,
      await this.#getBergmotWasmArrayBuffer(),
      await this.#getTranslationModels(fromLanguage, toLanguage)
    );
    await worker.isReady;
    return worker;
  }

  /**
   * Get the list of languages and their display names, sorted by their display names.
   *
   * @returns {Promise<Array<{ langTag: string, displayName }>>}
   */
  getSupportedLanguages() {
    return this.sendQuery("Translations:GetSupportedLanguages");
  }
}
