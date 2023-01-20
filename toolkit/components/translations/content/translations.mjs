/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

const { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

/**
 * This comment block imports the types for use in JSDoc. The TypeScript language server
 * can provide in-editor hints for the types.
 *
 * @typedef {import("../translations").WasmRecord} WasmRecord
 * @typedef {import("../translations").ModelRecord} ModelRecord
 * @typedef {import("../translations").TranslationMessage} TranslationMessage
 * @typedef {import("../translations").ModelTypes} ModelTypes
 */

/**
 * @type {TranslationsState | undefined}
 */
let translationsState;

/**
 * While the feature is in development, hide the feature behind a pref. See
 * modules/libpref/init/all.js and Bug 971044 for the status of enabling this project.
 */
function updateEnabledState() {
  if (Services.prefs.getBoolPref("browser.translations.enable")) {
    translationsState = new TranslationsState();

    lazy.console.log("Translation state initialized", translationsState);

    document.body.style.visibility = "visible";
  } else {
    translationsState?.destroy();
    translationsState = undefined;

    document.body.style.visibility = "hidden";
  }
}

class TranslationsUI {
  /** @type {HTMLSelectElement} */
  languageFrom = document.getElementById("language-from");
  /** @type {HTMLSelectElement} */
  languageTo = document.getElementById("language-to");
  /** @type {HTMLTextAreaElement} */
  translationFrom = document.getElementById("translation-from");
  /** @type {HTMLDivElement} */
  translationTo = document.getElementById("translation-to");
  /** @type {TranslationsState} */
  state;

  /**
   * @param {TranslationsState} state
   */
  constructor(state) {
    this.state = state;
    this.setupDropdowns();
    this.setupTextarea();
    // TODO - I think this can be removed.
    this.uiReady();
  }

  uiReady() {
    this.translationTo.classList.remove(
      "about-translations-input-results-loading"
    );
  }

  /**
   * Once the models have been synced from remote settings, populate them with the display
   * names of the languages.
   */
  async setupDropdowns() {
    const supportedLanguages = await this.state.supportedLanguages;
    // Update the DOM elements with the display names.
    for (const { langTag, displayName } of supportedLanguages) {
      let option = document.createElement("option");
      option.value = langTag;
      option.text = displayName;
      this.languageTo.add(option);

      option = document.createElement("option");
      option.value = langTag;
      option.text = displayName;
      this.languageFrom.add(option);
    }

    // Set the translate "from" to the app locale, if it is in the list.
    const appLocale = new Services.intl.Locale(
      Services.locale.appLocaleAsBCP47
    );
    for (const option of this.languageFrom.options) {
      if (option.value === appLocale.language) {
        this.languageFrom.value = option.value;
        break;
      }
    }

    // Enable the controls.
    this.languageFrom.disabled = false;
    this.languageTo.disabled = false;

    // Focus the language dropdowns if they are empty.
    if (this.languageFrom.value == "") {
      this.languageFrom.focus();
    } else if (this.languageTo.value == "") {
      this.languageTo.focus();
    }

    this.state.setFromLanguage(this.languageFrom.value);
    this.state.setToLanguage(this.languageTo.value);

    this.languageFrom.addEventListener("input", () => {
      this.state.setFromLanguage(this.languageFrom.value);
    });

    this.languageTo.addEventListener("input", () => {
      this.state.setToLanguage(this.languageTo.value);
    });
  }

  setupTextarea() {
    this.translationFrom.addEventListener("input", () => {
      this.state.setMessageToTranslate(this.translationFrom.value);
    });
  }

  /**
   * @param {string} message
   */
  updateTranslation(message) {
    this.translationTo.innerText = message;
  }
}

/**
 * The model and controller for initializing about:translations.
 */
class TranslationsState {
  /**
   * This class is responsible for all UI updated.
   *
   * @type {TranslationsUI}
   */
  ui;

  /**
   * The language to translate from, in the form of a BCP 47 language tag,
   * e.g. "en" or "fr".
   *
   * @type {string}
   */
  fromLanguage = "";

  /**
   * The language to translate to, in the form of a BCP 47 language tag,
   * e.g. "en" or "fr".
   *
   * @type {string}
   */
  toLanguage = "";

  /**
   * The message to translate, cached so that it can be determined if the text
   * needs to be re-translated.
   *
   * @type {string}
   */
  messageToTranslate = "";

  translationsChild = window.windowGlobalChild.getActor("Translations");

  /**
   * The translations worker is only valid for a single language pair, and needs
   * to be recreated if the language pair changes.
   *
   * @type {null | Promise<TranslationsWorker>}
   */
  translationsWorker = null;

  constructor() {
    this.supportedLanguages = this.translationsChild.getSupportedLanguages();
    this.ui = new TranslationsUI(this);
  }

  /**
   * Only request translation when it's needed.
   */
  async maybeRequestTranslation() {
    if (
      !this.fromLanguage ||
      !this.toLanguage ||
      !this.messageToTranslate ||
      !this.translationsWorker
    ) {
      // Not everything is set for translation.
      this.ui.updateTranslation("");
      return;
    }

    const translationsWorker = await this.translationsWorker;
    const start = performance.now();
    lazy.console.log(
      "Requesting translation:",
      JSON.stringify(this.messageToTranslate.slice(0, 20)) + "..."
    );
    const [translation] = await translationsWorker.translate([
      this.messageToTranslate,
    ]);
    this.ui.updateTranslation(translation);
    const duration = performance.now() - start;
    lazy.console.log(`Translation done in ${duration / 1000} seconds`);
  }

  /**
   * @param {string} lang
   */
  setFromLanguage(lang) {
    if (lang !== this.fromLanguage) {
      this.fromLanguage = lang;
      if (this.toLanguage) {
        // The language pair changed, rebuild the worker.
        this.rebuildWorker();
      }
      this.maybeRequestTranslation();
    }
  }

  async rebuildWorker() {
    const start = performance.now();
    lazy.console.log("Rebuilding the translations worker");
    this.translationsWorker = this.translationsChild.getTranslationsWorker(
      this.fromLanguage,
      this.toLanguage
    );
    try {
      await this.translationsWorker;
      const duration = performance.now() - start;
      lazy.console.log(
        `Rebuilt the translations worker in ${duration / 1000} seconds`
      );
      this.maybeRequestTranslation();
    } catch (error) {
      lazy.console.error("Failed to get the Translations worker", error);
    }
  }

  /**
   * @param {string} lang
   */
  setToLanguage(lang) {
    if (lang !== this.toLanguage) {
      this.toLanguage = lang;
      if (this.fromLanguage) {
        // The language pair changed, rebuild the worker.
        this.rebuildWorker();
      }
      this.maybeRequestTranslation();
    }
  }

  /**
   * @param {string} message
   */
  setMessageToTranslate(message) {
    if (message !== this.messageToTranslate) {
      this.messageToTranslate = message;
      this.maybeRequestTranslation();
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  updateEnabledState();
  Services.prefs.addObserver("browser.translations.enable", updateEnabledState);
});
