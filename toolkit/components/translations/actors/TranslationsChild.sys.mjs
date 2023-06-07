/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};
ChromeUtils.defineESModuleGetters(lazy, {
  TranslationsEngine:
    "chrome://global/content/translations/translations-utils.sys.mjs",
  LanguageIdEngine:
    "chrome://global/content/translations/translations-utils.sys.mjs",
});

/**
 * This file is extremely sensitive to memory size and performance!
 */
export class TranslationsChild extends JSWindowActorChild {
  /**
   * Store this at the beginning so that there is no risk of access a dead object
   * to read it.
   * @type {number | null}
   */
  innerWindowId = null;
  isDestroyed = false;
  #didTranslate = false;
  #isRestrictedPage;

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

  async receiveMessage({ name, data }) {
    switch (name) {
      case "Translations:TranslatePage": {
        if (!this.isRestrictedPage()) {
          lazy.TranslationsEngine.translatePage(this, data).catch(error =>
            console.error("Failed to translate page", error)
          );
          this.#didTranslate = true;
        }
        return undefined;
      }
      case "Translations:GetLangTagsForTranslation":
        return this.getLangTagsForTranslation();
      case "Translations:GetContentWindowPrincipal":
        return this.getContentWindowPrincipal();
      case "Translations:GetDocumentElementLang":
        return this.document.documentElement.lang;
      case "Translations:IdentifyLanguage": {
        const engine = await lazy.LanguageIdEngine.getOrCreate(() =>
          this.sendQuery("Translations:GetLanguageIdEnginePayload")
        );
        return engine.identifyLanguageFromDocument(this.document);
      }
      default:
        throw new Error("Unknown message.", name);
    }
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

  sendEngineIsReady() {
    this.sendAsyncMessage("Translations:EngineIsReady");
  }

  async getTranslationsEnginePayload(fromLanguage, toLanguage) {
    return this.sendQuery("Translations:GetTranslationsEnginePayload", {
      fromLanguage,
      toLanguage,
    });
  }

  async didDestroy() {
    this.isDestroyed = true;
    if (this.#didTranslate) {
      lazy.TranslationsEngine.discardTranslationQueue(this.innerWindowId);
    }
  }
}
