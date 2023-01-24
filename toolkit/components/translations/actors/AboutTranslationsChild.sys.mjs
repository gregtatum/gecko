/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations [about]",
  });
});

/**
 * The AboutTranslationsChild is responsible for coordinating what privileged APIs
 * are exposed to the un-privileged scope of the about:translations page.
 */
export class AboutTranslationsChild extends JSWindowActorChild {
  actorCreated() {
    this.#exportFunctions();
  }

  handleEvent() {
    // This is a required function.
  }

  /**
   * @returns {TranslationsChild}
   */
  #getTranslationsChild() {
    const child = this.contentWindow.windowGlobalChild.getActor("Translations");
    if (!child) {
      throw new Error("Unable to find the TranslationsChild");
    }
    return child;
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

    const fns = [
      "AT_isEnabled",
      "AT_log",
      "AT_logError",
      "AT_isLoggingEnabled",
      "AT_getAppLocale",
      "AT_getSupportedLanguages",
      "AT_getBergamotWasmArrayBuffer",
      "AT_getLanguageModelFiles",
      "AT_getWorker",
    ];
    for (const name of fns) {
      Cu.exportFunction(this[name].bind(this), window, { defineAs: name });
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
    return (
      Services.prefs.getCharPref("browser.translations.logLevel") === "All"
    );
  }

  /**
   * Returns the app's locale.
   *
   * @return {Intl.Locale}
   */
  AT_getAppLocale() {
    return Cu.cloneInto(
      {...(new Services.intl.Locale(Services.locale.appLocaleAsBCP47))},
      this.contentWindow
    );
  }

  /**
   * Wire this function to the TranslationsChild.
   *
   * @returns {Promise<Array<{ langTag: string, displayName }>>}
   */
  AT_getSupportedLanguages() {
    return this.#wrapPromise(
      this.#getTranslationsChild()
        .getSupportedLanguages()
        .then(data => Cu.cloneInto(data, this.contentWindow))
    );
  }

  /**
   * Wire this function to the TranslationsChild.
   */
  AT_getBergamotWasmArrayBuffer() {
    return this.#wrapPromise(
      this.#getTranslationsChild()
        .getBergamotWasmArrayBuffer()
        .then(data => Cu.cloneInto(data, this.contentWindow))
    );
  }

  /**
   * Wire this function to the TranslationsChild.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   */
  AT_getLanguageModelFiles(fromLanguage, toLanguage) {
    return this.#wrapPromise(
      this.#getTranslationsChild()
        .getLanguageModelFiles(fromLanguage, toLanguage)
        .then(data => Cu.cloneInto(data, this.contentWindow))
    );
  }

  /**
   * @returns {Worker}
   */
  AT_getWorker() {
    return Cu.cloneInto(
      new Worker("resource://gre/modules/translations/engine-worker.js"),
      this.contentWindow
    );
  }
}
