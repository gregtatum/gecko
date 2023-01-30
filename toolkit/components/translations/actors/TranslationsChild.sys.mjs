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
 * @typedef {import("../translations").LanguageModelFiles} LanguageModelFiles
 * @typedef {import("../translations").EnginePayload} EnginePayload
 */

/**
 * The TranslationsEngine encapsulates the logic for translating messages. It can
 * only be set up for a single language translation pair. In order to change languages
 * a new engine should be constructed.
 *
 * The actual work for the translations happens in a worker. This class manages
 * instantiating and messaging the worker.
 */
export class TranslationsEngine {
  /** @type {Worker} */
  #worker;
  // Multiple messages can be sent before a response is received. This ID is used to keep
  // track of the messages. It is incremented on every use.
  #messageId = 0;

  /**
   * Construct and initialize the worker.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {EnginePayload} enginePayload
   */
  constructor(fromLanguage, toLanguage, enginePayload) {
    /** @type {string} */
    this.fromLanguage = fromLanguage;
    /** @type {string} */
    this.toLanguage = toLanguage;
    this.#worker = new Worker(
      "chrome://global/content/translations/engine-worker.js"
    );

    /** @type {Promise<void>} */
    this.isReady = new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        lazy.console.log("Received initialization message", data);
        if (data.type === "initialization-success") {
          resolve();
        } else if (data.type === "initialization-failure") {
          reject(data.error);
        }
        this.#worker.removeEventListener("message", onMessage);
      };
      this.#worker.addEventListener("message", onMessage);
    });

    this.#worker.postMessage({
      type: "initialize",
      fromLanguage,
      toLanguage,
      enginePayload,
      messageId: this.#messageId++,
      isLoggingEnabled:
        Services.prefs.getCharPref("browser.translations.logLevel") === "All",
    });
  }

  /**
   * @param {string[]} messageBatch
   * @returns {Promise<string>}
   */
  translate(messageBatch) {
    const messageId = this.#messageId++;
    lazy.console.log("Translating", messageBatch);

    return new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        lazy.console.log("Received message", data);
        if (data.messageId !== messageId) {
          // Multiple translation requests can be sent before a response is received.
          // Ensure that the response received here is the correct one.
          return;
        }
        if (data.type === "translation-response") {
          resolve(data.translations);
        }
        if (data.type === "translation-error") {
          reject(data.error);
        }
        this.#worker.removeEventListener("message", onMessage);
      };

      this.#worker.addEventListener("message", onMessage);

      this.#worker.postMessage({
        type: "translation-request",
        messageBatch,
        messageId,
      });
    });
  }

  /**
   * The worker should be GCed just fine on its own, but go ahead and signal to
   * the worker that it's no longer needed. This will immediately cancel any in-progress
   * translations.
   */
  terminate() {
    this.#worker.terminate();
  }
}

/**
 * See the TranslationsParent for documentation.
 */
export class TranslationsChild extends JSWindowActorChild {
  /**
   * The data for the Bergamot translation engine is downloaded from Remote Settings
   * and cached to disk. It is retained here in child process in case the translation
   * language switches.
   *
   * At the time of this writing ~5mb.
   *
   * @type {ArrayBuffer | null}
   */
  #bergamotWasmArrayBuffer = null;

  /**
   * The translations engine could be mocked for tests, since the wasm and the language
   * models must be downloaded from Remote Settings.
   */
  #isEngineMocked = false;

  /**
   * @returns {Promise<ArrayBuffer>}
   */
  async #getBergamotWasmArrayBuffer() {
    if (this.#isEngineMocked) {
      throw new Error(
        "The engine is mocked, the Bergamot wasm is not available."
      );
    }
    let arrayBuffer = this.#bergamotWasmArrayBuffer;
    if (!arrayBuffer) {
      arrayBuffer = await this.sendQuery(
        "Translations:GetBergamotWasmArrayBuffer"
      );
      this.#bergamotWasmArrayBuffer = arrayBuffer;
    }
    return arrayBuffer;
  }

  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {Promise<LanguageModelFiles[]>}
   */
  async #getLanguageModelFiles(fromLanguage, toLanguage) {
    if (this.#isEngineMocked) {
      throw new Error(
        "The engine is mocked, there are no language model files available."
      );
    }
    return this.sendQuery("Translations:GetLanguageModelFiles", {
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
   * Receive a message from the parent.
   *
   * @param {{ name: string, data: any }} message
   */
  receiveMessage(message) {
    switch (message.name) {
      case "Translations:IsMocked":
        this.#isEngineMocked = message.data;
        break;
      default:
        lazy.console.warn("Unknown message.");
    }
  }

  /**
   * Get the list of languages and their display names, sorted by their display names.
   *
   * TODO (Bug 1813775) - Not all languages have bi-directional translations, like
   * Icelandic. These are listed as "Beta" in the addon. This list should be changed into
   * a "from" and "to" list, and the logic enhanced in the dropdowns to only allow valid
   * translations.
   *
   * @returns {Promise<Array<{ langTag: string, displayName }>>}
   */
  getSupportedLanguages() {
    return this.sendQuery("Translations:GetSupportedLanguages");
  }

  /**
   * The engine is not avialable in tests.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {null | EnginePayload}
   */
  async #getEnginePayload(fromLanguage, toLanguage) {
    if (this.#isEngineMocked) {
      return null;
    }
    const [bergamotWasmArrayBuffer, languageModelFiles] = await Promise.all([
      this.#getBergamotWasmArrayBuffer(),
      this.#getLanguageModelFiles(fromLanguage, toLanguage),
    ]);
    return { bergamotWasmArrayBuffer, languageModelFiles };
  }

  /**
   * Construct and initialize the Translations Engine.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   */
  async createTranslationsEngine(fromLanguage, toLanguage) {
    const enginePayload = await this.#getEnginePayload(
      fromLanguage,
      toLanguage
    );

    const engine = new TranslationsEngine(
      fromLanguage,
      toLanguage,
      enginePayload
    );

    await engine.isReady;
    return engine;
  }
}
