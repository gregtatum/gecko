/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

const lazy = {};

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

/**
 * @typedef {import("./TranslationsChild.sys.mjs").TranslationsEngine} TranslationsEngine
 */

/**
 * The AboutTranslationsChild is responsible for coordinating what privileged APIs
 * are exposed to the un-privileged scope of the about:translations page.
 */
export class AboutTranslationsChild extends JSWindowActorChild {

  /** @type {TranslationsEngine | null} */
  engine = null;

  handleEvent(event) {
    if (event.type === "DOMDocElementInserted") {
      this.#exportFunctions();
    }
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
      "AT_getAppLocale",
      "AT_getSupportedLanguages",
      "AT_createTranslationsEngine",
      "AT_translate",
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
   * Returns the app's locale.
   *
   * @return {Intl.Locale}
   */
  AT_getAppLocale() {
    return Services.locale.appLocaleAsBCP47;
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
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {Promise<void>}
   */
  AT_createTranslationsEngine(fromLanguage, toLanguage) {
    return this.#wrapPromise(
      this.#getTranslationsChild()
      .createTranslationsEngine(fromLanguage, toLanguage)
      .then(engine => {
        this.engine = engine;
      })
    );
  }

  /**
   * @param {string[]} messageBatch
   * @returns {Promise<string[]>}
   */
  AT_translate(messageBatch) {
    if (!this.engine) {
      throw new this.contentWindow.Error("The translations engine was not created.");
    }
    return this.#wrapPromise(
      this.engine.translate(messageBatch)
      .then(translations => Cu.cloneInto(translations, this.contentWindow))
    );
  }
}
