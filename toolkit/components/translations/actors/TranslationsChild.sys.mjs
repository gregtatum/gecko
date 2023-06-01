/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @typedef {import("../content/translations-document.sys.mjs").TranslationsDocument} TranslationsDocument
 * @typedef {import("../content/translations-utils.sys.mjs").TranslationsEngineCache} TranslationsEngineCache
 * @typedef {import("../translations").LanguageIdEnginePayload} LanguageIdEnginePayload
 * @typedef {import("../translations").LanguageTranslationModelFiles} LanguageTranslationModelFiles
 * @typedef {import("../translations").TranslationsEnginePayload} TranslationsEnginePayload
 * @typedef {import("../translations").LanguagePair} LanguagePair
 * @typedef {import("../translations").SupportedLanguages} SupportedLanguages
 * @typedef {import("../translations").LangTags} LangTags
 */

/**
 * @type {{
 *   TranslationsDocument: typeof TranslationsDocument
 *   console: typeof console
 * }}
 */
const lazy = {};

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

ChromeUtils.defineESModuleGetters(lazy, {
  TranslationsEngine:
    "chrome://global/content/translations/translations-utils.sys.mjs",
  TranslationsEngineCache:
    "chrome://global/content/translations/translations-utils.sys.mjs",
  LanguageIdEngine:
    "chrome://global/content/translations/translations-utils.sys.mjs",
  TranslationsDocument:
    "chrome://global/content/translations/translations-document.sys.mjs",
  TranslationsTelemetry:
    "chrome://global/content/translations/TranslationsTelemetry.sys.mjs",
});

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

/**
 * See the TranslationsParent for documentation.
 */
export class TranslationsChild extends JSWindowActorChild {
  /**
   * The getter for the TranslationsEngine, managed by the EngineCache.
   *
   * @type {null | (() => Promise<TranslationsEngine>) | ((fromCache: true) => Promise<TranslationsEngine | null>)}
   */
  #getTranslationsEngine = null;

  /**
   * The actor can be destroyed leaving dangling references to dead objects.
   */
  #isDestroyed = false;

  /**
   * Store this at the beginning so that there is no risk of access a dead object
   * to read it.
   * @type {number | null}
   */
  innerWindowId = null;

  /**
   * @type {TranslationsDocument | null}
   */
  translatedDoc = null;

  /**
   * The engine cache, which is lazily instantiated.
   *
   * @type {TranslationsEngineCache | null}
   */
  static #engineCache = null;

  /**
   * @overrides JSWindowActorChild.prototype.handleEvent
   * @param {{ type: string }} event
   */
  handleEvent(event) {
    switch (event.type) {
      case "DOMContentLoaded":
        this.innerWindowId = this.contentWindow.windowGlobalChild.innerWindowId;
        if (!this.isRestrictedPage()) {
          this.sendAsyncMessage("Translations:ReportLangTags", {
            documentElementLang: this.document.documentElement.lang,
          });
        }
        break;
      case "pagehide":
        if (!this.isRestrictedPage()) {
          this.sendAsyncMessage("Translations:ClearLangTags");
        }
        break;
    }
  }

  #isRestrictedPage;

  /**
   * Only translate pages that match certain protocols, that way internal pages like
   * about:* pages will not be translated.
   */
  isRestrictedPage() {
    if (this.#isRestrictedPage !== undefined) {
      return this.#isRestrictedPage;
    }
    const { href } = this.contentWindow.location;
    // Keep this logic up to date with TranslationsParent.isRestrictedPage.
    return !(
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("file:///")
    );
  }

  /**
   * Load the translation engine and translate the page.
   *
   * @param {{fromLanguage: string, toLanguage: string}} langTags
   * @param {number} [translationsStart]
   * @returns {Promise<void>}
   */
  async translatePage(
    fromLanguage,
    toLanguage,
    translationsStart = this.docShell.now()
  ) {
    if (this.translatedDoc) {
      lazy.console.warn("This page was already translated.");
      return;
    }
    if (this.isRestrictedPage()) {
      lazy.console.warn("Attempting to translate a restricted page.");
      return;
    }

    try {
      const engineLoadStart = this.docShell.now();
      if (!TranslationsChild.#engineCache) {
        TranslationsChild.#engineCache = new lazy.TranslationsEngineCache();
      }
      // Create a function to get an engine. These engines are pretty heavy in terms
      // of memory usage, so they will be destroyed when not in use, and attempt to
      // be re-used when loading a new page.
      this.#getTranslationsEngine =
        await TranslationsChild.#engineCache.createGetter(
          this,
          fromLanguage,
          toLanguage
        );
      if (this.#isDestroyed) {
        return;
      }

      // Start loading the engine if it doesn't exist.
      this.#getTranslationsEngine().then(
        () => {
          ChromeUtils.addProfilerMarker(
            "TranslationsChild",
            { innerWindowId: this.innerWindowId, startTime: engineLoadStart },
            "Load Translations Engine"
          );
        },
        error => {
          lazy.TranslationsTelemetry.onError(error);
          lazy.console.log("Failed to load the translations engine.", error);
        }
      );
    } catch (error) {
      lazy.TranslationsTelemetry.onError(error);
      lazy.console.log(
        "Failed to load the translations engine",
        error,
        this.contentWindow.location.href
      );
      this.sendAsyncMessage("Translations:FullPageTranslationFailed", {
        reason: "engine-load-failure",
      });
      return;
    }

    // Ensure the translation engine loads correctly at least once before instantiating
    // the TranslationsDocument.
    try {
      await this.#getTranslationsEngine();
    } catch (error) {
      lazy.TranslationsTelemetry.onError(error);
      this.sendAsyncMessage("Translations:FullPageTranslationFailed", {
        reason: "engine-load-failure",
      });
      return;
    }

    this.translatedDoc = new lazy.TranslationsDocument(
      this.document,
      fromLanguage,
      this.innerWindowId,
      html =>
        this.#getTranslationsEngine().then(engine =>
          engine.translateHTML([html], this.innerWindowId)
        ),
      text =>
        this.#getTranslationsEngine().then(engine =>
          engine.translateText([text], this.innerWindowId)
        ),
      () => this.docShell.now()
    );

    lazy.console.log(
      "Beginning to translate.",
      this.contentWindow.location.href
    );

    this.sendAsyncMessage("Translations:EngineIsReady");

    this.translatedDoc.addRootElement(this.document.querySelector("title"));
    this.translatedDoc.addRootElement(
      this.document.body,
      true /* reportWordsInViewport */
    );

    {
      const startTime = this.docShell.now();
      this.translatedDoc.viewportTranslated.then(() => {
        ChromeUtils.addProfilerMarker(
          "TranslationsChild",
          { innerWindowId: this.innerWindowId, startTime },
          "Viewport translations"
        );
        ChromeUtils.addProfilerMarker(
          "TranslationsChild",
          { innerWindowId: this.innerWindowId, startTime: translationsStart },
          "Time to first translation"
        );
      });
    }
  }

  /**
   * @param {{ name: string, data: any }} message
   */
  async receiveMessage({ name, data }) {
    switch (name) {
      case "Translations:TranslatePage": {
        const { fromLanguage, toLanguage } = data;
        this.translatePage(fromLanguage, toLanguage);
        break;
      }
      case "Translations:GetLangTagsForTranslation":
        return this.getLangTagsForTranslation();
      case "Translations:GetContentWindowPrincipal":
        return this.getContentWindowPrincipal();
      case "Translations:GetDocumentElementLang":
        return this.document.documentElement.lang;
      case "Translations:IdentifyLanguage": {
        const engine = await lazy.LanguageIdEngine.createFromPayload(
          this.sendQuery("Translations:GetLanguageIdEnginePayload")
        );
        return engine.identifyLanguageFromDocument(this.document);
      }
      default:
        lazy.console.warn("Unknown message.", name);
    }
    return undefined;
  }

  getSupportedLanguages() {
    return this.sendQuery("Translations:GetSupportedLanguages");
  }

  hasAllFilesForLanguage(language) {
    return this.sendQuery("Translations:HasAllFilesForLanguage", {
      language,
    });
  }

  deleteLanguageFiles(language) {
    return this.sendQuery("Translations:DeleteLanguageFiles", {
      language,
    });
  }

  downloadLanguageFiles(language) {
    return this.sendQuery("Translations:DownloadLanguageFiles", {
      language,
    });
  }

  downloadAllFiles() {
    return this.sendQuery("Translations:DownloadAllFiles");
  }

  deleteAllLanguageFiles() {
    return this.sendQuery("Translations:DeleteAllLanguageFiles");
  }

  async #getTranslationsEnginePayload(fromLanguage, toLanguage) {
    return this.sendQuery("Translations:GetTranslationsEnginePayload", {
      fromLanguage,
      toLanguage,
    });
  }

  /**
   * Construct and initialize the Translations Engine.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {TranslationsEngine | null}
   */
  async createTranslationsEngine(fromLanguage, toLanguage) {
    const startTime = this.docShell.now();
    const enginePayload = await this.#getTranslationsEnginePayload(
      fromLanguage,
      toLanguage
    );

    const engine = new lazy.TranslationsEngine(
      fromLanguage,
      toLanguage,
      enginePayload,
      this.innerWindowId
    );

    await engine.isReady;

    ChromeUtils.addProfilerMarker(
      "TranslationsChild",
      { innerWindowId: this.innerWindowId, startTime },
      `Translations engine loaded for "${fromLanguage}" to "${toLanguage}"`
    );
    return engine;
  }

  /**
   * Override JSWindowActorChild.prototype.didDestroy. This is called by the actor
   * manager when the actor was destroyed.
   */
  async didDestroy() {
    this.#isDestroyed = true;
    const getTranslationsEngine = this.#getTranslationsEngine;
    if (!getTranslationsEngine) {
      return;
    }
    const engine = await getTranslationsEngine(
      // Just get it from cache, don't create a new one.
      true
    );
    if (engine) {
      // Discard the queue otherwise the worker will continue to translate.
      engine.discardTranslationQueue(this.innerWindowId);

      // Keep it alive long enough for another page load.
      TranslationsChild.#engineCache?.keepAlive(
        engine.fromLanguage,
        engine.toLanguage
      );
    }
  }
}
