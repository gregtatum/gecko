/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Construct and initialize the Translations Engine.
 *
 * @param {string} fromLanguage
 * @param {string} toLanguage
 * @param {ArrayBuffer} bergmotWasmArrayBuffer
 * @param {Object} languageModelFiles
 * @param {[(...any) => void]} log - An optional logging function.
 */
export async function createTranslationsEngine(
  fromLanguage,
  toLanguage,
  bergamotWasmArrayBuffer,
  languageModelFiles,
  log
) {
  const engine = new TranslationsEngine(
    fromLanguage,
    toLanguage,
    bergamotWasmArrayBuffer,
    languageModelFiles,
    log
  );
  await engine.isReady;
  return engine;
}

/**
 * The TranslationsEngine encapsulates the logic for translating messages. It can
 * only be set up for a single language translation pair. In order to change languages
 * a new engine should be constructed.
 *
 * The actual work for the translations happens in a worker. This class manages
 * instantiating and messaging the server.
 */
export class TranslationsEngine {
  #messageGeneration = 0;

  /**
   * Construct and initialize the worker.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {ArrayBuffer} bergamotWasmArrayBuffer
   * @param {Object} languageModelFiles
   * @param {[(...any) => void]} log - An optional logging function.
   */
  constructor(
    fromLanguage,
    toLanguage,
    bergamotWasmArrayBuffer,
    languageModelFiles,
    log
  ) {
    /** @type {string} */
    this.fromLanguage = fromLanguage;
    /** @type {string} */
    this.toLanguage = toLanguage;
    /** @type {Worker} */
    this.worker = AT_getWorker();
    /** @type {(...any) => void} */
    this.log = log ?? (() => {});

    /** @type {Promise<void>} */
    this.isReady = new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
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
      bergmotWasmArrayBuffer: bergamotWasmArrayBuffer,
      languageModelFiles,
      isLoggingEnabled: Boolean(log),
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
        log("Received message", data);
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
