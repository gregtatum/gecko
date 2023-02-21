/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @type {{
 *   TranslatedDocument: typeof import("../content/translated-document.sys.mjs").TranslatedDocument
 *   console: typeof console
 * }}
 */
const lazy = {};

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

ChromeUtils.defineESModuleGetters(lazy, {
  setTimeout: "resource://gre/modules/Timer.sys.mjs",
  clearTimeout: "resource://gre/modules/Timer.sys.mjs",
  TranslatedDocument:
    "chrome://global/content/translations/translated-document.sys.mjs",
});

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

const CACHE_TIMEOUT = 10_000;
class EngineCache {
  /** @type {Record<string, Promise<TranslationsEngine>} */
  #engines = {};

  /** @type {Record<string, TimeoutID} */
  #timeouts = {};

  /**
   * Returns a getter function that will create a translations engine on the first
   * call, and then return the cached one. After a timeout when the engine hasn't
   * been used, it is destroyed.
   *
   * @param {TranslationsChild} actor
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {(() => Promise<TranslationsEngine>) | ((onlyFromCache: true) => Promise<TranslationsEngine | null>)}
   */
  createGetter(actor, fromLanguage, toLanguage) {
    return async (onlyFromCache = false) => {
      let enginePromise = this.#engines[fromLanguage + toLanguage];
      if (enginePromise) {
        return enginePromise;
      }
      if (onlyFromCache) {
        return null;
      }

      // A new engine needs to be created.
      enginePromise = actor.createTranslationsEngine(fromLanguage, toLanguage);

      this.#engines[fromLanguage + toLanguage] = enginePromise;

      const engine = await enginePromise;

      // These methods will be spied on, and when called they will keep the engine alive.
      this.spyOn(engine, "translateText");
      this.spyOn(engine, "translateHTML");
      this.spyOn(engine, "discardTranslationQueue");
      this.keepAlive(fromLanguage, toLanguage);

      return engine;
    };
  }

  /**
   * Spies on a method, so that when it is called, the engine is kept alive.
   *
   * @param {TranslationsEngine} engine
   * @param {string} methodName
   */
  spyOn(engine, methodName) {
    const method = engine[methodName].bind(engine);
    engine[methodName] = (...args) => {
      this.keepAlive(engine.fromLanguage, engine.toLanguage);
      return method(...args);
    };
  }

  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   */
  keepAlive(fromLanguage, toLanguage) {
    const languagePair = fromLanguage + toLanguage;
    const timeoutId = this.#timeouts[languagePair];
    if (timeoutId) {
      lazy.clearTimeout(timeoutId);
    }
    const enginePromise = this.#engines[languagePair];
    this.#timeouts[languagePair] = lazy.setTimeout(() => {
      // Delete the caches.
      delete this.#engines[languagePair];
      delete this.#timeouts[languagePair];

      // Terminate the engine worker.
      enginePromise.then(engine => engine.terminate());
    }, CACHE_TIMEOUT);
  }

  /**
   * Sees if an engine is still in the cache.
   */
  isInCache(fromLanguage, toLanguage) {
    this.keepAlive(fromLanguage, toLanguage);
    return Boolean(this.#engines[fromLanguage + toLanguage]);
  }
}

const engineCache = new EngineCache();

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
   * Translate text without any HTML.
   *
   * @param {string[]} messageBatch
   * @returns {Promise<string[]>}
   */
  translateText(messageBatch) {
    return this.#translate(messageBatch, false);
  }

  /**
   * Translate valid HTML. Note that this method throws if invalid markup is provided.
   *
   * @param {string[]} messageBatch
   * @returns {Promise<string[]>}
   */
  translateHTML(messageBatch) {
    return this.#translate(messageBatch, true);
  }

  /**
   * The implementation for translation. Use translateText or translateHTML for the
   * public API.
   *
   * @param {string[]} messageBatch
   * @param {boolean} isHTML
   * @returns {Promise<string[]>}
   */
  #translate(messageBatch, isHTML) {
    const messageId = this.#messageId++;
    lazy.console.log("Translating", messageBatch);

    return new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        if (data.type === "translations-discarded") {
          this.#worker.removeEventListener("message", onMessage);
          return;
        }

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
        isHTML,
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

  /**
   * Stop processing the translation queue. All message
   */
  discardTranslationQueue() {
    ChromeUtils.addProfilerMarker(
      "TranslationsChild",
      null,
      "!!! Request to discard translations"
    );
    this.#worker.postMessage({
      type: "discard-translation-queue",
    });
  }

  /**
   * Gets the language pair for the engine which is useful as a key.
   * @returns {string}
   */
  getLanguagePair() {
    return this.fromLanguage + this.toLanguage;
  }
}

/**
 * See the TranslationsParent for documentation.
 */
export class TranslationsChild extends JSWindowActorChild {
  constructor() {
    super();
    ChromeUtils.addProfilerMarker(
      "TranslationsChild",
      null,
      "TranslationsChild constructor"
    );
  }
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
   * The getter for the TranslationsEngine, managed by the EngineCache.
   *
   * @type {null | (() => Promise<TranslationsEngine>) | ((true) => Promise<TranslationsEngine | null>)}
   */
  #getEngine = null;

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
    ChromeUtils.addProfilerMarker(
      "TranslationsChild",
      null,
      "Event: " + event.type
    );
    if (event.type === "DOMContentLoaded") {
      this.maybeTranslateDocument();
    }
  }

  async maybeTranslateDocument() {
    ChromeUtils.addProfilerMarker("TranslationsChild", null, "start");
    const translationsStart = this.docShell.now();
    let appLangTag = new Intl.Locale(Services.locale.appLocaleAsBCP47).language;
    let docLangTag;

    const { innerWindowId } = this.contentWindow.windowGlobalChild;

    try {
      const docLocale = new Intl.Locale(this.document.documentElement.lang);
      docLangTag = docLocale.language;
    } catch (error) {}

    if (!docLangTag) {
      const message = "No valid language detected.";
      ChromeUtils.addProfilerMarker(
        "TranslationsChild",
        { innerWindowId },
        message
      );
      lazy.console.log(message, this.contentWindow.location.href);
      return;
    }

    if (appLangTag === docLangTag) {
      const message =
        "The app and document languages match, so not translating.";
      ChromeUtils.addProfilerMarker(
        "TranslationsChild",
        { innerWindowId },
        message
      );
      lazy.console.log(message, this.contentWindow.location.href);
      return;
    }

    // There is no reason to look at supported languages if the engine is already in
    // the cache.
    if (!engineCache.isInCache(docLangTag, appLangTag)) {
      // TODO - This is wrong for non-bidirectional translation pairs.
      const supportedLanguages = await this.getSupportedLanguages();
      if (
        !supportedLanguages.some(({ langTag }) => langTag === appLangTag) ||
        !supportedLanguages.some(({ langTag }) => langTag === docLangTag)
      ) {
        const message = `Translating from "${docLangTag}" to "${appLangTag}" is not supported.`;
        ChromeUtils.addProfilerMarker(
          "TranslationsChild",
          { innerWindowId },
          message
        );
        lazy.console.log(message, supportedLanguages);
        return;
      }
    }

    try {
      // Create a function to get an engine. These engines are pretty heavy in terms
      // of memory usage, so they will be destroyed when not in use, and attempt to
      // be re-used when loading a new page.
      this.#getEngine = await engineCache.createGetter(
        this,
        docLangTag,
        appLangTag
      );

      // Start loading the engine if it doesn't exist.
      this.#getEngine();
    } catch (error) {
      lazy.console.error(
        "Failed to load the translations engine",
        error,
        this.contentWindow.location.href
      );
      return;
    }

    const translatedDoc = new lazy.TranslatedDocument(
      this.document,
      "en",
      html => this.#getEngine().then(engine => engine.translateHTML([html])),
      text => this.#getEngine().then(engine => engine.translateText([text])),
      () => this.docShell.now()
    );

    lazy.console.log(
      "Beginning to translate.",
      this.contentWindow.location.href
    );

    translatedDoc.addRootElement(this.document.body);
    translatedDoc.addRootElement(this.document.querySelector("title"));

    {
      const startTime = this.docShell.now();
      translatedDoc.viewportTranslated.then(() => {
        ChromeUtils.addProfilerMarker(
          "TranslationsChild",
          { innerWindowId, startTime },
          "Viewport translations"
        );
        ChromeUtils.addProfilerMarker(
          "TranslationsChild",
          { innerWindowId, startTime: translationsStart },
          "Time to first translation"
        );
      });
    }
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
   * The engine is not available in tests.
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
    debugger;
    const startTime = this.docShell.now();

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

    const { innerWindowId } = this.contentWindow.windowGlobalChild;

    ChromeUtils.addProfilerMarker(
      "TranslationsChild",
      { innerWindowId, startTime },
      `Translations engine loaded for "${fromLanguage}" to "${toLanguage}"`
    );
    return engine;
  }

  async didDestroy() {
    const getEngine = this.#getEngine;
    if (!getEngine) {
      return;
    }
    const engine = await getEngine(
      // Just get it from cache, don't create a new one.
      true
    );
    if (engine) {
      // The worker will continue to translate the queue unless it is manually discarded.
      engine.discardTranslationQueue();

      // Keep it alive long enough for another page load.
      engineCache.keepAlive(engine.fromLanguage, engine.toLanguage);
    }
  }
}
