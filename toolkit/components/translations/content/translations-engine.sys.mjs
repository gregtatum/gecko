/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* eslint-env browser */
/* globals TE_addProfilerMarker, TE_getLogLevel, TE_log, TE_logError, TE_getLogLevel,
           TE_requestEnginePayload */

/**
 * This file lives in the translation engine's content process. It is unpriviliged,
 * and is in charge of managing the lifecycle the translations engine.
 *
 * TOD(before landing) - Document this process better.
 */

// How long the cache remains alive between uses, in milliseconds.
const CACHE_TIMEOUT_MS = 10_000;

/**
 * @typedef {import("./translations-document.sys.mjs").TranslationsDocument} TranslationsDocument
 * @typedef {import("../translations.js").TranslationsEnginePayload} TranslationsEnginePayload
 */

/**
 * The TranslationsEngine encapsulates the logic for translating messages. It can
 * only be set up for a single language translation pair. In order to change languages
 * a new engine should be constructed.
 *
 * The actual work for the translations happens in a worker. This class manages
 * instantiating and messaging the worker.
 *
 * Keep 1 language engine around in the TranslationsEngine.#cachedEngine cache in case
 * page navigation happens and we can re-use the previous engine. The engines are very
 * heavy-weight, so we only want to keep one around at a time.
 */
export class TranslationsEngine {
  /** @type {null | { languagePairKey: string, enginePromise: Promise<TranslationsEngine> }} */
  static #cachedEngine = null;

  /** @type {null | TimeoutID} */
  static #keepAliveTimeout = null;

  /** @type {Worker} */
  #translationsWorker;

  /**
   * Multiple messages can be sent before a response is received. This ID is used to keep
   * track of the messages. It is incremented on every use.
   */
  #messageId = 0;

  /**
   * @type {TranslationsDocument | null}
   */
  translatedDoc = null;

  /**
   * Returns a getter function that will create a translations engine on the first
   * call, and then return the cached one. After a timeout when the engine hasn't
   * been used, it is destroyed.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {number} innerWindowId
   * @returns {Promise<TranslationsEngine | null>}
   */
  static getOrCreate(fromLanguage, toLanguage) {
    const languagePairKey = getLanguagePairKey(fromLanguage, toLanguage);
    if (this.#cachedEngine?.languagePairKey === languagePairKey) {
      return this.#cachedEngine.enginePromise;
    }

    // A new engine needs to be created.
    const enginePromise = TranslationsEngine.create(fromLanguage, toLanguage);

    this.#cachedEngine = { languagePairKey, enginePromise };
    TranslationsEngine.keepAlive(languagePairKey);

    enginePromise.then(
      () => {
        void TranslationsEngine.keepAlive(languagePairKey);
      },
      error => {
        TE_logError(
          `The engine failed to load for translating "${fromLanguage}" to "${toLanguage}". Removing it from the cache.`,
          error
        );
        // Remove the engine if it fails to initialize.
        this.#cachedEngine = null;
      }
    );

    return enginePromise;
  }

  /**
   * Create a TranslationsEngine and bypass the cache.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {Promise<TranslationsEngine>}
   */
  static async create(fromLanguage, toLanguage) {
    const startTime = performance.now();

    const engine = new TranslationsEngine(
      fromLanguage,
      toLanguage,
      await TE_requestEnginePayload()
    );

    await engine.isReady;

    TE_addProfilerMarker({
      startTime,
      message: `Translations engine loaded for "${fromLanguage}" to "${toLanguage}"`,
    });

    return engine;
  }

  /**
   * Only get the engine from the cache if it exists.
   */
  static getFromCache(fromLanguage, toLanguage) {
    if (
      this.#cachedEngine?.languagePairKey ===
      getLanguagePairKey(fromLanguage, toLanguage)
    ) {
      return this.#cachedEngine.enginePromise;
    }
    return null;
  }

  /**
   * @param {string} languagePairKey
   */
  static keepAlive(languagePairKey) {
    if (
      !TranslationsEngine.#cachedEngine?.languagePairKey !== languagePairKey
    ) {
      // It appears that the engine is already dead or another language pair
      // is being used.
      return;
    }
    if (TranslationsEngine.#keepAliveTimeout) {
      clearTimeout(TranslationsEngine.#keepAliveTimeout);
    }

    TranslationsEngine.#keepAliveTimeout = setTimeout(() => {
      // Terminate the engine worker.
      TranslationsEngine.#cachedEngine?.enginePromise.then(engine =>
        engine.terminate()
      );
    }, CACHE_TIMEOUT_MS);
  }

  /**
   * Construct and initialize the worker.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {TranslationsEnginePayload} enginePayload - If there is no engine payload
   *   then the engine will be mocked. This allows this class to be used in tests.
   */
  constructor(fromLanguage, toLanguage, enginePayload) {
    /** @type {string} */
    this.fromLanguage = fromLanguage;
    /** @type {string} */
    this.toLanguage = toLanguage;
    this.languagePairKey = getLanguagePairKey(fromLanguage, toLanguage);
    this.#translationsWorker = new Worker(
      "chrome://global/content/translations/translations-engine-worker.js"
    );

    /** @type {Promise<void>} */
    this.isReady = new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        TE_log("Received initialization message", data);
        if (data.type === "initialization-success") {
          resolve();
        } else if (data.type === "initialization-error") {
          reject(data.error);
        }
        this.#translationsWorker.removeEventListener("message", onMessage);
      };
      this.#translationsWorker.addEventListener("message", onMessage);
    });

    // Make sure the ArrayBuffers are transferred, not cloned.
    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects
    const transferables = [];
    if (enginePayload) {
      transferables.push(enginePayload.bergamotWasmArrayBuffer);
      for (const files of enginePayload.languageModelFiles) {
        for (const { buffer } of Object.values(files)) {
          transferables.push(buffer);
        }
      }
    }

    this.#translationsWorker.postMessage(
      {
        type: "initialize",
        fromLanguage,
        toLanguage,
        enginePayload,
        messageId: this.#messageId++,
        logLevel: TE_getLogLevel(),
      },
      transferables
    );
  }

  /**
   * The implementation for translation. Use translateText or translateHTML for the
   * public API.
   *
   * @param {string} sourceText
   * @param {boolean} isHTML
   * @param {number} innerWindowId
   * @returns {Promise<string[]>}
   */
  translate(sourceText, isHTML, innerWindowId) {
    TranslationsEngine.keepAlive(this.languagePairKey);

    const messageId = this.#messageId++;

    return new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        if (
          data.type === "translations-discarded" &&
          data.innerWindowId === innerWindowId
        ) {
          // The page was unloaded, and we no longer need to listen for a response.
          this.#translationsWorker.removeEventListener("message", onMessage);
          return;
        }

        if (data.messageId !== messageId) {
          // Multiple translation requests can be sent before a response is received.
          // Ensure that the response received here is the correct one.
          return;
        }

        if (data.type === "translation-response") {
          resolve(data.targetText);
        }
        if (data.type === "translation-error") {
          reject(data.error);
        }
        this.#translationsWorker.removeEventListener("message", onMessage);
      };

      this.#translationsWorker.addEventListener("message", onMessage);

      this.#translationsWorker.postMessage({
        type: "translation-request",
        isHTML,
        sourceText,
        messageId,
        innerWindowId,
      });
    });
  }

  /**
   * The worker should be GCed just fine on its own, but go ahead and signal to
   * the worker that it's no longer needed. This will immediately cancel any in-progress
   * translations.
   */
  terminate() {
    this.#translationsWorker.terminate();
    TranslationsEngine.#cachedEngine?.then(engine => {
      if (engine === this) {
        TranslationsEngine.#cachedEngine = null;
      }
    });
  }

  /**
   * Stop processing the translation queue. All in-progress messages will be discarded.
   *
   * @param {number} innerWindowId
   */
  static discardTranslationQueue(innerWindowId) {
    TranslationsEngine.#cachedEngine?.enginePromise.then(engine => {
      TE_addProfilerMarker({
        message: "Request to discard translation queue",
      });
      engine.discardTranslationQueue(innerWindowId);
    });
  }

  /**
   * Stop processing the translation queue. All in-progress messages will be discarded.
   *
   * @param {number} innerWindowId
   */
  discardTranslationQueue(innerWindowId) {
    this.#translationsWorker.postMessage({
      type: "discard-translation-queue",
      innerWindowId,
    });
    this.translatedDoc = null;

    // Keep alive for another page laod.
    TranslationsEngine.keepAlive(this.languagePairKey);
  }
}

/**
 * Creates a lookup key that is unique to each fromLanguage-toLanguage pair.
 *
 * @param {string} fromLanguage
 * @param {string} toLanguage
 * @returns {string}
 */
function getLanguagePairKey(fromLanguage, toLanguage) {
  return `${fromLanguage},${toLanguage}`;
}

const ports = new Map();

/**
 * Listen for events coming from the TranslationsEngine actor.
 */
window.addEventListener("TranslationsEngineChromeToContent", ({ detail }) => {
  switch (detail.type) {
    case "StartTranslation": {
      const { fromLanguage, toLanguage, innerWindowId, port } = detail;
      // Listen to the port to the content process for incoming messages, and pass
      // them to the TranslationsEngine manager.
      port.onmessage = async ({ sourceText, isHTML, messageId }) => {
        const engine = await TranslationsEngine.getOrCreate(
          fromLanguage,
          toLanguage
        );
        if (!engine) {
          return;
        }
        const targetText = await engine.translate(
          sourceText,
          isHTML,
          innerWindowId
        );
        port.postMessage({
          messageId,
          targetText,
        });
      };

      ports.set(innerWindowId, port);
      break;
    }
    case "EndTranslation": {
      const { innerWindowId } = detail;

      // Deleting a reference to the port and unsetting the onmessage handler may
      // not be strictly necessary, but it's better to be safe that we aren't leaking.
      const port = ports.delete(innerWindowId);
      if (port) {
        port.onmessage = null;
        ports.delete(innerWindowId);
      }

      // The page no longer needs its translations.
      TranslationsEngine.discardTranslationQueue(innerWindowId);
      break;
    }
    default:
      throw new Error("Unknown TranslationsEngineChromeToContent event.");
  }
});
