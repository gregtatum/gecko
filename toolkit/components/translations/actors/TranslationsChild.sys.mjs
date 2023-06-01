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
});

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

/**
 * The threshold that the language-identification confidence
 * value must be greater than in order to provide the detected language
 * tag for translations.
 *
 * This value should ideally be one that does not allow false positives
 * while also not being too restrictive.
 *
 * At this time, this value is not driven by statistical data or analysis.
 */
const DOC_LANGUAGE_DETECTION_THRESHOLD = 0.65;

/**
 * The length of the substring to pull from the document's text for language
 * identification.
 *
 * This value should ideally be one that is large enough to yield a confident
 * identification result without being too large or expensive to extract.
 *
 * At this time, this value is not driven by statistical data or analysis.
 */
const DOC_TEXT_TO_IDENTIFY_LENGTH = 1024;

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
   * The matched language tags for the page. Used to find a default language pair for
   * translations.
   *
   * @type {null | LangTags}
   * */
  #langTags = null;

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
            href: this.contentWindow.location.href,
            documentElementLang: this.document.documentElement.lang,
            contentWindowPrincipal: this.getContentWindowPrincipal(),
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

  /**
   * Returns the principal from the content window's origin.
   * @returns {nsIPrincipal | null}
   */
  getContentWindowPrincipal() {
    const { origin } = this.contentWindow.location;
    try {
      return Services.scriptSecurityManager.createContentPrincipalFromOrigin(
        origin
      );
    } catch (error) {
      return null;
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
   * @returns {string | null}
   */
  async identifyLanguage() {
    let languageIdEngine = await this.createLanguageIdEngine();

    // Grab a selection of text.
    let encoder = Cu.createDocumentEncoder("text/plain");
    encoder.init(this.document, "text/plain", encoder.SkipInvisibleContent);
    let text = encoder
      .encodeToStringWithMaxLength(DOC_TEXT_TO_IDENTIFY_LENGTH)
      .replaceAll("\r", "")
      .replaceAll("\n", " ");

    let { langTag, confidence } = await languageIdEngine.identifyLanguage(text);

    lazy.console.log(
      `${langTag}(${confidence.toFixed(2)}) Detected Page Language`
    );
    return confidence >= DOC_LANGUAGE_DETECTION_THRESHOLD ? langTag : null;
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
          lazy.console.error("Failed to load the translations engine.", error);
        }
      );
    } catch (error) {
      lazy.console.error(
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
   * Receive a message from the parent.
   *
   * @param {{ name: string, data: any }} message
   */
  receiveMessage({ name, data }) {
    switch (name) {
      case "Translations:TranslatePage":
        const langTags = data ?? this.#langTags;
        if (!langTags) {
          lazy.console.warn(
            "Attempting to translate a page, but no language tags were given."
          );
          break;
        }
        this.translatePage(langTags.fromLanguage, langTags.toLanguage);
        break;
      case "Translations:GetLangTagsForTranslation":
        return this.getLangTagsForTranslation();
      case "Translations:GetContentWindowPrincipal":
        return this.getContentWindowPrincipal();
      case "Translations:GetDocumentElementLang":
        return this.document.documentElement.lang;
      case "Translations:IdentifyLanguage":
        return this.identifyLanguage();
      default:
        lazy.console.warn("Unknown message.", name);
    }
    return undefined;
  }

  /**
   * Get the list of languages and their display names, sorted by their display names.
   * This is more expensive of a call than getLanguagePairs since the display names
   * are looked up.
   *
   * @returns {Promise<Array<SupportedLanguages>>}
   */
  getSupportedLanguages() {
    return this.sendQuery("Translations:GetSupportedLanguages");
  }

  /**
   * @param {string} language The BCP 47 language tag.
   */
  hasAllFilesForLanguage(language) {
    return this.sendQuery("Translations:HasAllFilesForLanguage", {
      language,
    });
  }

  /**
   * @param {string} language The BCP 47 language tag.
   */
  deleteLanguageFiles(language) {
    return this.sendQuery("Translations:DeleteLanguageFiles", {
      language,
    });
  }

  /**
   * @param {string} language The BCP 47 language tag.
   */
  downloadLanguageFiles(language) {
    return this.sendQuery("Translations:DownloadLanguageFiles", {
      language,
    });
  }

  /**
   * Download all files from Remote Settings.
   */
  downloadAllFiles() {
    return this.sendQuery("Translations:DownloadAllFiles");
  }

  /**
   * Delete all language files.
   * @returns {Promise<string[]>} Returns a list of deleted record ids.
   */
  deleteAllLanguageFiles() {
    return this.sendQuery("Translations:DeleteAllLanguageFiles");
  }

  /**
   * Get the language pairs that can be used for translations. This is cheaper than
   * the getSupportedLanguages call, since the localized display names of the languages
   * are not needed.
   *
   * @returns {Promise<Array<LanguagePair>>}
   */
  getLanguagePairs() {
    return this.sendQuery("Translations:GetLanguagePairs");
  }

  /**
   * Retrieve the payload for creating a LanguageIdEngine.
   *
   * @returns {Promise<LanguageIdEnginePayload>}
   */
  async #getLanguageIdEnginePayload() {
    return this.sendQuery("Translations:GetLanguageIdEnginePayload");
  }

  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {TranslationsEnginePayload}
   */
  async #getTranslationsEnginePayload(fromLanguage, toLanguage) {
    return this.sendQuery("Translations:GetTranslationsEnginePayload", {
      fromLanguage,
      toLanguage,
    });
  }

  /**
   * Construct and initialize the LanguageIdEngine.
   *
   * @returns {LanguageIdEngine}
   */
  async createLanguageIdEngine() {
    const payload = await this.#getLanguageIdEnginePayload();
    const engine = new lazy.LanguageIdEngine(payload);
    await engine.isReady;
    return engine;
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
