/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

const lazy = {};

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations [about]",
  });
});


class AboutTranslationsChild extends JSWindowActorChild {
  actorCreated() {
    this.#exportFunctions();
  }

  /**
   * @returns {TranslationsChild}
   */
  #getTranslationsChild() {
    return this.contentWindow.windowGlobalChild.getActor("Translations");
  }

  /**
   * Wrap a promise so content can use Promise methods.
   */
  #wrapPromise(promise) {
    return new this.contentWindow.Promise((resolve, reject) =>
      promise.then(resolve, reject)
    );
  }


  /**
   * Export any of the child functions that start with "AT_" to the unprivileged content
   * page. This restricts the security capabilities of the the content page.
   */
  #exportFunctions() {
    const window = this.contentWindow;

    for (const [defineAs, fn] of Object.entries(ExportToContent)) {
      if (defineAs.startsWith("AT_")) {
        Cu.exportFunction(fn.bind(this), window, { defineAs });
      }
    }
  }

  /**
   * Is the translations feature enabled?
   *
   * @returns {bool}
   */
  AT_isEnabled() {
    return Services.prefs.getBoolPref("browser.translations.enable");
  }

  /**
   * Log messages if "browser.translations.logLevel" is set to "All".
   */
  AT_log(...args) {
    lazy.console.log(...args);
  }

  /**
   * Report an error to the console.
   */
  AT_logError(...args) {
    lazy.console.error(...args);
  }

  /**
   * Log messages if "browser.translations.logLevel" is set to "All".
   */
  AT_isLoggingEnabled(...args) {
    return Services.prefs.getCharPref("browser.translations.logLevel") === "All";
  }

  /**
   * Returns the app's locale.
   *
   * @return {Intl.Locale}
   */
  AT_getAppLocale() {
    return new Services.intl.Locale(
      Services.locale.appLocaleAsBCP47
    )
  }

  /**
   * Wire this function to the TranslationsChild.
   *
   * @returns {Promise<Array<{ langTag: string, displayName }>>}
   */
  AT_getSupportedLanguages() {
    return this.#wrapPromise(this.#getTranslationsChild().getSupportedLanguages());
  }

  /**
   * Wire this function to the TranslationsChild.
   */
  AT_getBergamotWasmArrayBuffer() {
    return this.#wrapPromise(this.#getTranslationsChild().getBergamotWasmArrayBuffer());
  }

  /**
   * Wire this function to the TranslationsChild.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   */
  AT_getTranslationModels(fromLanguage, toLanguage) {
    return this.#wrapPromise(this.#getTranslationsChild().getTranslationModels(fromLanguage, toLanguage));
  }
}
