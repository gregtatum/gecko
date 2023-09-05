/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const PIVOT_LANGUAGE = "en";

const TRANSLATIONS_PERMISSION = "translations";
const ALWAYS_TRANSLATE_LANGS_PREF =
  "browser.translations.alwaysTranslateLanguages";
const NEVER_TRANSLATE_LANGS_PREF =
  "browser.translations.neverTranslateLanguages";

const lazy = {};

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";
import { AppConstants } from "resource://gre/modules/AppConstants.sys.mjs";

if (AppConstants.ENABLE_WEBDRIVER) {
  XPCOMUtils.defineLazyServiceGetter(
    lazy,
    "Marionette",
    "@mozilla.org/remote/marionette;1",
    "nsIMarionette"
  );

  XPCOMUtils.defineLazyServiceGetter(
    lazy,
    "RemoteAgent",
    "@mozilla.org/remote/agent;1",
    "nsIRemoteAgent"
  );
} else {
  lazy.Marionette = { running: false };
  lazy.RemoteAgent = { running: false };
}

ChromeUtils.defineESModuleGetters(lazy, {
  TranslationsTelemetry:
    "chrome://global/content/translations/TranslationsTelemetry.sys.mjs",
});

ChromeUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "translationsEnabledPref",
  "browser.translations.enable"
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "autoTranslatePagePref",
  "browser.translations.autoTranslate"
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "chaosErrorsPref",
  "browser.translations.chaos.errors"
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "chaosTimeoutMSPref",
  "browser.translations.chaos.timeoutMS"
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "automaticallyPopupPref",
  "browser.translations.automaticallyPopup"
);

/**
 * Returns the always-translate language tags as an array.
 */
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "alwaysTranslateLangTags",
  ALWAYS_TRANSLATE_LANGS_PREF,
  /* aDefaultPrefValue */ "",
  /* onUpdate */ null,
  /* aTransform */ rawLangTags =>
    rawLangTags ? new Set(rawLangTags.split(",")) : new Set()
);

/**
 * Returns the never-translate language tags as an array.
 */
XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "neverTranslateLangTags",
  NEVER_TRANSLATE_LANGS_PREF,
  /* aDefaultPrefValue */ "",
  /* onUpdate */ null,
  /* aTransform */ rawLangTags =>
    rawLangTags ? new Set(rawLangTags.split(",")) : new Set()
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "simulateUnsupportedEnginePref",
  "browser.translations.simulateUnsupportedEngine"
);

XPCOMUtils.defineLazyPreferenceGetter(
  lazy,
  "useFastTextPref",
  "browser.translations.languageIdentification.useFastText"
);

/**
 * The translations parent is used to orchestrate translations in Firefox. It can
 * download the wasm translation engines, and the machine learning language models.
 *
 * See Bug 971044 for more details of planned work.
 */
export class TranslationsParent extends JSWindowActorParent {
  /**
   * Contains the state that would affect UI. Anytime this state is changed, a dispatch
   * event is sent so that UI can react to it. The actor is inside of /toolkit and
   * needs a way of notifying /browser code (or other users) of when the state changes.
   *
   * @type {TranslationsLanguageState}
   */
  languageState;

  /**
   * The cached URI spec where the panel was first ever shown, as determined by the
   * browser.translations.panelShown pref.
   *
   * Holding on to this URI value allows us to show the introductory message in the panel
   * when the panel opens, as long as the active panel is open on that particular URI.
   *
   * @type {string | null}
   */
  firstShowUriSpec = null;

  /**
   * Do not send queries or do work when the actor is already destroyed. This flag needs
   * to be checked after calls to `await`.
   */
  #isDestroyed = false;

  /**
   * Remember the detected languages on a page reload. This will keep the translations
   * button from disappearing and reappearing, which causes the button to lose focus.
   *
   * @type {LangTags | null} previousDetectedLanguages
   */
  static #previousDetectedLanguages = null;

  actorCreated() {
    this.languageState = new TranslationsLanguageState(
      this,
      TranslationsParent.#previousDetectedLanguages
    );
    TranslationsParent.#previousDetectedLanguages = null;
  }

  /**
   * If "browser.translations.autoTranslate" is set to "true" then the page will
   * auto-translate. A user can restore the page to the original UI. This flag indicates
   * that an auto-translate should be skipped.
   */
  static #isPageRestoredForAutoTranslate = false;

  /**
   * Allows the actor's behavior to be changed when the translations engine is mocked via
   * a dummy RemoteSettingsClient.
   *
   * @type {bool}
   */
  static #isTranslationsEngineMocked = false;

  /**
   * The language identification engine can be mocked for testing
   * by pre-defining this value.
   *
   * @type {string | null}
   */
  static #mockedLangTag = null;

  /**
   * The language identification engine can be mocked for testing
   * by pre-defining this value.
   *
   * @type {number | null}
   */
  static #mockedLanguageIdConfidence = null;

  /**
   * @type {null | Promise<boolean>}
   */
  static #isTranslationsEngineSupported = null;

  /**
   * When reloading the page, store the translation pair that needs translating.
   *
   * @type {null | TranslationPair}
   */
  static #translateOnPageReload = null;

  /**
   * An ordered list of preferred languages based on:
   *   1. App languages
   *   2. Web requested languages
   *   3. OS language
   *
   * @type {null | string[]}
   */
  static #preferredLanguages = null;

  /**
   * The value of navigator.languages.
   *
   * @type {null | Set<string>}
   */
  static #webContentLanguages = null;

  static #observingLanguages = false;

  // On a fast connection, 10 concurrent downloads were measured to be the fastest when
  // downloading all of the language files.
  static MAX_CONCURRENT_DOWNLOADS = 10;
  static MAX_DOWNLOAD_RETRIES = 3;

  // The set of hosts that have already been offered for translations.
  static #hostsOffered = new Set();

  // Enable the translations popup offer in tests.
  static testAutomaticPopup = false;

  /**
   * Telemetry functions for Translations
   * @returns {TranslationsTelemetry}
   */
  static telemetry() {
    return lazy.TranslationsTelemetry;
  }

  /**
   * TODO(Bug 1834306) - Cu.isInAutomation doesn't recognize Marionette and RemoteAgent
   * tests.
   */
  static isInAutomation() {
    return (
      Cu.isInAutomation || lazy.Marionette.running || lazy.RemoteAgent.running
    );
  }

  /**
   * Offer translations (for instance by automatically opening the popup panel) whenever
   * languages are detected, but only do it once per host per session.
   * @param {LangTags} detectedLanguages
   */
  maybeOfferTranslations(detectedLanguages) {
    if (!lazy.automaticallyPopupPref) {
      return;
    }
    if (!this.browsingContext.currentWindowGlobal) {
      return;
    }
    const { documentURI } = this.browsingContext.currentWindowGlobal;

    if (
      TranslationsParent.isInAutomation() &&
      !TranslationsParent.testAutomaticPopup
    ) {
      // Do not offer translations in automation, as many tests do not expect this
      // behavior.
      lazy.console.log(
        "maybeOfferTranslations - Do not offer translations in automation.",
        documentURI.spec
      );
      return;
    }

    if (
      !detectedLanguages.docLangTag ||
      !detectedLanguages.userLangTag ||
      !detectedLanguages.isDocLangTagSupported
    ) {
      lazy.console.log(
        "maybeOfferTranslations - The detected languages were not supported.",
        detectedLanguages
      );
      return;
    }

    let host;
    try {
      host = documentURI.host;
    } catch {
      // nsIURI.host can throw if the URI scheme doesn't have a host. In this case
      // do not offer a translation.
      return;
    }
    if (TranslationsParent.#hostsOffered.has(host)) {
      // This host was already offered a translation.
      lazy.console.log(
        "maybeOfferTranslations - Host already offered a translation, so skip.",
        documentURI.spec
      );
      return;
    }
    const browser = this.browsingContext.top.embedderElement;
    if (!browser) {
      return;
    }
    TranslationsParent.#hostsOffered.add(host);
    const { CustomEvent } = browser.ownerGlobal;

    if (
      TranslationsParent.shouldNeverTranslateLanguage(
        detectedLanguages.docLangTag
      )
    ) {
      lazy.console.log(
        `maybeOfferTranslations - Should never translate language. "${detectedLanguages.docLangTag}"`,
        documentURI.spec
      );
      return;
    }
    if (this.shouldNeverTranslateSite()) {
      lazy.console.log(
        "maybeOfferTranslations - Should never translate site.",
        documentURI.spec
      );
      return;
    }

    // Only offer the translation if it's still the current page.
    if (
      documentURI.spec ===
      this.browsingContext.topChromeWindow.gBrowser.selectedBrowser.documentURI
        .spec
    ) {
      lazy.console.log(
        "maybeOfferTranslations - Offering a translation",
        documentURI.spec,
        detectedLanguages
      );

      browser.dispatchEvent(
        new CustomEvent("TranslationsParent:OfferTranslation", {
          bubbles: true,
        })
      );
    }
  }

  /**
   * This is for testing purposes.
   */
  static resetHostsOffered() {
    TranslationsParent.#hostsOffered = new Set();
  }

  static onIsTranslationsEngineSupported(callback) {
    callback(true);
  }

  static isRestrictedPage(scheme) {
    switch (scheme) {
      case "https":
      case "http":
      case "file":
        return false;
    }
    return true;
  }

  static #resetPreferredLanguages() {
    TranslationsParent.#webContentLanguages = null;
    TranslationsParent.#preferredLanguages = null;
    TranslationsParent.getPreferredLanguages();
  }

  /**
   * Provide a way for tests to override the system locales.
   * @type {null | string[]}
   */
  static mockedSystemLocales = null;

  static getWebContentLanguages() {
    if (!TranslationsParent.#webContentLanguages) {
      const values = Services.prefs
        .getComplexValue("intl.accept_languages", Ci.nsIPrefLocalizedString)
        .data.split(/\s*,\s*/g);

      TranslationsParent.#webContentLanguages = new Set();

      for (const locale of values) {
        try {
          // Wrap this in a try statement since users can manually edit this pref.
          TranslationsParent.#webContentLanguages.add(
            new Intl.Locale(locale).language
          );
        } catch {
          // The locale was invalid, discard it.
        }
      }

      if (
        !Services.prefs.prefHasUserValue("intl.accept_languages") &&
        Services.locale.appLocaleAsBCP47 !== "en" &&
        !Services.locale.appLocaleAsBCP47.startsWith("en-")
      ) {
        // The user hasn't customized their accept languages, this means that English
        // is always provided as a fallback language, even if it is not available.
        TranslationsParent.#webContentLanguages.delete("en");
      }
    }

    return TranslationsParent.#webContentLanguages;
  }

  static getPreferredLanguages() {
    return ["en"];
  }

  async receiveMessage({ name, data }) {
    switch (name) {
      case "Translations:GetIsTranslationsEngineMocked": {
        return TranslationsParent.#isTranslationsEngineMocked;
      }
      case "Translations:FullPageTranslationFailed": {
        this.languageState.error = data.reason;
        break;
      }
      case "Translations:GetSupportedLanguages": {
        return TranslationsParent.getSupportedLanguages();
      }
      case "Translations:SendTelemetryError": {
        TranslationsParent.telemetry().onError(data.errorMessage);
        break;
      }
      case "Translations:EngineIsReady": {
        this.isEngineReady = true;
        this.languageState.isEngineReady = true;
        break;
      }
      case "Translations:IsTranslationsEngineSupported": {
        return TranslationsParent.getIsTranslationsEngineSupported();
      }
    }
    return undefined;
  }

  /**
   * @param {string} documentElementLang
   */
  async reportLangTags(documentElementLang) {
    // TODO - Add href.
    const detectedLanguages = await this.getDetectedLanguages(
      documentElementLang
    ).catch(error => {
      // Detecting the languages can fail if the page gets destroyed before it
      // can be completed. This runs on every page that doesn't have a lang tag,
      // so only report the error if you have Translations logging turned on to
      // avoid console spam.
      lazy.console.log("Failed to get the detected languages.", error);
    });

    if (!detectedLanguages) {
      // The actor was already destroyed, and the detectedLanguages weren't reported
      // in time.
      return;
    }

    this.languageState.detectedLanguages = detectedLanguages;

    if (this.shouldAutoTranslate(detectedLanguages)) {
      this.translate(
        detectedLanguages.docLangTag,
        detectedLanguages.userLangTag,
        true // reportAsAutoTranslate
      );
    } else {
      this.maybeOfferTranslations(detectedLanguages);
    }
  }

  /**
   * Returns true if translations should auto-translate from the given
   * language, otherwise returns false.
   *
   * @param {string} langTag - A BCP-47 language tag
   * @returns {boolean}
   */
  static #maybeAutoTranslate(langTag) {
    if (
      // The user has not marked this language as always translate.
      !TranslationsParent.shouldAlwaysTranslateLanguage(langTag) &&
      // The pref to always auto-translate is off.
      !lazy.autoTranslatePagePref
    ) {
      return false;
    }

    if (TranslationsParent.#isPageRestoredForAutoTranslate) {
      // The user clicked the restore button. Respect it for one page load.
      TranslationsParent.#isPageRestoredForAutoTranslate = false;

      // Skip this auto-translation.
      return false;
    }

    // The page can be auto-translated
    return true;
  }

  /**
   * Creates a lookup key that is unique to each fromLanguage-toLanguage pair.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {string}
   */
  static languagePairKey(fromLanguage, toLanguage) {
    return `${fromLanguage},${toLanguage}`;
  }

  /**
   * The cached language pairs.
   * @type {Promise<Array<LanguagePair>> | null}
   */
  static #languagePairs = null;

  /**
   * Get the list of translation pairs supported by the translations engine.
   *
   * @returns {Promise<Array<LanguagePair>>}
   */
  static getLanguagePairs() {
    if (!TranslationsParent.#languagePairs) {
      TranslationsParent.#languagePairs =
        TranslationsParent.#getTranslationModelRecords().then(records => {
          const languagePairMap = new Map();

          for (const { fromLang, toLang } of records.values()) {
            const key = TranslationsParent.languagePairKey(fromLang, toLang);
            if (!languagePairMap.has(key)) {
              languagePairMap.set(key, { fromLang, toLang });
            }
          }
          return Array.from(languagePairMap.values());
        });
    }
    return TranslationsParent.#languagePairs;
  }

  /**
   * Get the list of languages and their display names, sorted by their display names.
   * This is more expensive of a call than getLanguagePairs since the display names
   * are looked up.
   *
   * This is all of the information needed to render dropdowns for translation
   * language selection.
   *
   * @returns {Promise<SupportedLanguages>}
   */
  static async getSupportedLanguages() {
    const languagePairs = await TranslationsParent.getLanguagePairs();

    /** @type {Set<string>} */
    const fromLanguages = new Set();
    /** @type {Set<string>} */
    const toLanguages = new Set();

    for (const { fromLang, toLang } of languagePairs) {
      fromLanguages.add(fromLang);
      toLanguages.add(toLang);
    }

    // Build a map of the langTag to the display name.
    /** @type {Map<string, string>} */
    const displayNames = new Map();
    {
      const dn = new Services.intl.DisplayNames(undefined, {
        type: "language",
      });

      for (const langTagSet of [fromLanguages, toLanguages]) {
        for (const langTag of langTagSet.keys()) {
          if (displayNames.has(langTag)) {
            continue;
          }
          displayNames.set(langTag, dn.of(langTag));
        }
      }
    }

    const addDisplayName = langTag => ({
      langTag,
      displayName: displayNames.get(langTag),
    });

    const sort = (a, b) => a.displayName.localeCompare(b.displayName);

    return {
      languagePairs,
      fromLanguages: Array.from(fromLanguages.keys())
        .map(addDisplayName)
        .sort(sort),
      toLanguages: Array.from(toLanguages.keys())
        .map(addDisplayName)
        .sort(sort),
    };
  }

  static async getMaxVersionRecords(
    remoteSettingsClient,
    { filters = {}, lookupKey = record => record.name } = {}
  ) {
    return [];
  }

  /**
   * Lazily initializes the model records, and returns the cached ones if they
   * were already retrieved. The key of the returned `Map` is the record id.
   *
   * @returns {Promise<Map<string, TranslationModelRecord>>}
   */
  static async #getTranslationModelRecords() {
    return new Map();
  }

  /**
   * Report an error. Having this as a method allows tests to check that an error
   * was properly reported.
   * @param {Error} error - Providing an Error object makes sure the stack is properly
   *                        reported.
   * @param {any[]} args - Any args to pass on to console.error.
   */
  static reportError(error, ...args) {
    lazy.console.log(error, ...args);
  }

  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {boolean} reportAsAutoTranslate - In telemetry, report this as
   *   an auto-translate.
   */
  translate(fromLanguage, toLanguage, reportAsAutoTranslate) {}

  /**
   * Restore the page to the original language by doing a hard reload.
   *
   * @param {string} fromLanguage A BCP-47 language tag
   */
  restorePage(fromLanguage) {
    TranslationsParent.telemetry().onRestorePage();
    if (
      lazy.autoTranslatePagePref ||
      TranslationsParent.shouldAlwaysTranslateLanguage(fromLanguage)
    ) {
      // Skip auto-translate for one page load.
      TranslationsParent.#isPageRestoredForAutoTranslate = true;
    }
    this.languageState.requestedTranslationPair = null;
    TranslationsParent.#previousDetectedLanguages =
      this.languageState.detectedLanguages;

    const browser = this.browsingContext.embedderElement;
    browser.reload();
  }

  /**
   * Keep track of when the location changes.
   */
  static #locationChangeId = 0;

  static onLocationChange(browser) {
    if (!lazy.translationsEnabledPref) {
      // The pref isn't enabled, so don't attempt to get the actor.
      return;
    }
    let windowGlobal = browser.browsingContext.currentWindowGlobal;
    TranslationsParent.#locationChangeId++;
    let actor;
    try {
      actor = windowGlobal.getActor("Translations");
    } catch (_) {
      // The actor may not be supported on this page.
    }
    if (actor) {
      actor.languageState.locationChangeId =
        TranslationsParent.#locationChangeId;
    }
  }

  /**
   * Is this actor active for the current location change?
   *
   * @param {number} locationChangeId - The id sent by the "TranslationsParent:LanguageState" event.
   * @returns {boolean}
   */
  static isActiveLocation(locationChangeId) {
    return locationChangeId === TranslationsParent.#locationChangeId;
  }

  async queryIdentifyLanguage() {
    if (
      TranslationsParent.isInAutomation() &&
      !TranslationsParent.#mockedLangTag
    ) {
      return null;
    }
    return this.sendQuery("Translations:IdentifyLanguage", {
      useFastText: lazy.useFastTextPref,
    }).catch(error => {
      if (this.#isDestroyed) {
        // The actor was destroyed while this message was still being resolved.
        return null;
      }
      return Promise.reject(error);
    });
  }

  /**
   * Returns the language from the document element.
   *
   * @returns {Promise<string>}
   */
  queryDocumentElementLang() {
    return this.sendQuery("Translations:GetDocumentElementLang");
  }

  /**
   * @param {LangTags} langTags
   */
  shouldAutoTranslate(langTags) {
    if (
      langTags.docLangTag &&
      langTags.userLangTag &&
      langTags.isDocLangTagSupported &&
      TranslationsParent.#maybeAutoTranslate(langTags.docLangTag) &&
      !TranslationsParent.shouldNeverTranslateLanguage(langTags.docLangTag) &&
      !this.shouldNeverTranslateSite()
    ) {
      return true;
    }

    return false;
  }

  /**
   * Returns the lang tags that should be offered for translation. This is in the parent
   * rather than the child to remove the per-content process memory allocation amount.
   *
   * @param {string} [documentElementLang]
   * @returns {Promise<LangTags | null>} - Returns null if the actor was destroyed before
   *   the result could be resolved.
   */
  async getDetectedLanguages(documentElementLang) {
    if (this.languageState.detectedLanguages) {
      return this.languageState.detectedLanguages;
    }
    const langTags = {
      docLangTag: null,
      userLangTag: null,
      isDocLangTagSupported: false,
    };
    if (!TranslationsParent.getIsTranslationsEngineSupported()) {
      return null;
    }

    if (documentElementLang === undefined) {
      documentElementLang = await this.queryDocumentElementLang();
      if (this.#isDestroyed) {
        return null;
      }
    }

    let languagePairs = await TranslationsParent.getLanguagePairs();
    if (this.#isDestroyed) {
      return null;
    }

    const determineIsDocLangTagSupported = () =>
      Boolean(
        languagePairs.find(({ fromLang }) => fromLang === langTags.docLangTag)
      );

    // First try to get the langTag from the document's markup.
    try {
      const docLocale = new Intl.Locale(documentElementLang);
      langTags.docLangTag = docLocale.language;
      langTags.isDocLangTagSupported = determineIsDocLangTagSupported();
    } catch (error) {}

    if (langTags.docLangTag) {
      // If it's not supported, try it again with a canonicalized version.
      if (!langTags.isDocLangTagSupported) {
        langTags.docLangTag = Intl.getCanonicalLocales(langTags.docLangTag)[0];
        langTags.isDocLangTagSupported = determineIsDocLangTagSupported();
      }

      // If it's still not supported, map macro language codes to specific ones.
      //   https://en.wikipedia.org/wiki/ISO_639_macrolanguage
      if (!langTags.isDocLangTagSupported) {
        // If more macro language codes are needed, this logic can be expanded.
        if (langTags.docLangTag === "no") {
          // Choose "Norwegian Bokmål" over "Norwegian Nynorsk" as it is more widely used.
          //
          // https://en.wikipedia.org/wiki/Norwegian_language#Bokm%C3%A5l_and_Nynorsk
          //
          //   > A 2005 poll indicates that 86.3% use primarily Bokmål as their daily
          //   > written language, 5.5% use both Bokmål and Nynorsk, and 7.5% use
          //   > primarily Nynorsk.
          langTags.docLangTag = "nb";
          langTags.isDocLangTagSupported = determineIsDocLangTagSupported();
        }
      }
    } else {
      // If the document's markup had no specified langTag, attempt
      // to identify the page's language using the LanguageIdEngine.
      langTags.docLangTag = await this.queryIdentifyLanguage();
      if (this.#isDestroyed) {
        return null;
      }
      langTags.isDocLangTagSupported = determineIsDocLangTagSupported();
    }

    const preferredLanguages = TranslationsParent.getPreferredLanguages();

    if (!langTags.docLangTag) {
      const message = "No valid language detected.";
      ChromeUtils.addProfilerMarker(
        "TranslationsParent",
        { innerWindowId: this.innerWindowId },
        message
      );
      lazy.console.log(
        message,
        this.browsingContext.currentWindowGlobal?.documentURI.spec
      );

      const languagePairs = await TranslationsParent.getLanguagePairs();
      if (this.#isDestroyed) {
        return null;
      }

      // Attempt to find a good language to select for the user.
      langTags.userLangTag =
        preferredLanguages.find(langTag => langTag === languagePairs.toLang) ??
        null;

      return langTags;
    }

    if (TranslationsParent.getWebContentLanguages().has(langTags.docLangTag)) {
      // The doc language has been marked as a known language by the user, do not
      // offer a translation.
      const message =
        "The app and document languages match, so not translating.";
      ChromeUtils.addProfilerMarker(
        "TranslationsParent",
        { innerWindowId: this.innerWindowId },
        message
      );
      lazy.console.log(
        message,
        this.browsingContext.currentWindowGlobal?.documentURI.spec
      );
      // The docLangTag will be set, while the userLangTag will be null.
      return langTags;
    }

    // Attempt to find a matching language pair for a preferred language.
    for (const preferredLangTag of preferredLanguages) {
      if (!langTags.isDocLangTagSupported) {
        if (languagePairs.some(({ toLang }) => toLang === preferredLangTag)) {
          // Only match the "to" language, since the "from" is not supported.
          langTags.userLangTag = preferredLangTag;
        }
        break;
      }

      // Is there a direct language pair match?
      if (
        languagePairs.some(
          ({ fromLang, toLang }) =>
            fromLang === langTags.docLangTag && toLang === preferredLangTag
        )
      ) {
        // A match was found in one of the preferred languages.
        langTags.userLangTag = preferredLangTag;
        break;
      }

      // Is there a pivot language match?
      if (
        // Match doc -> pivot
        languagePairs.some(
          ({ fromLang, toLang }) =>
            fromLang === langTags.docLangTag && toLang === PIVOT_LANGUAGE
        ) &&
        // Match pivot -> preferred language
        languagePairs.some(
          ({ fromLang, toLang }) =>
            fromLang === PIVOT_LANGUAGE && toLang === preferredLangTag
        )
      ) {
        langTags.userLangTag = preferredLangTag;
        break;
      }
    }

    if (!langTags.userLangTag) {
      // No language pairs match.
      const message = `No matching translation pairs were found for translating from "${langTags.docLangTag}".`;
      ChromeUtils.addProfilerMarker(
        "TranslationsParent",
        { innerWindowId: this.innerWindowId },
        message
      );
      lazy.console.log(message, languagePairs);
    }

    return langTags;
  }

  /**
   * The pref for if we can always offer a translation when it's available.
   */
  static shouldAlwaysOfferTranslations() {
    return lazy.automaticallyPopupPref;
  }

  /**
   * Returns true if the given language tag is present in the always-translate
   * languages preference, otherwise false.
   *
   * @param {string} langTag - A BCP-47 language tag
   * @returns {boolean}
   */
  static shouldAlwaysTranslateLanguage(langTag) {
    return lazy.alwaysTranslateLangTags.has(langTag);
  }

  /**
   * Returns true if the given language tag is present in the never-translate
   * languages preference, otherwise false.
   *
   * @param {string} langTag - A BCP-47 language tag
   * @returns {boolean}
   */
  static shouldNeverTranslateLanguage(langTag) {
    return lazy.neverTranslateLangTags.has(langTag);
  }

  /**
   * Returns true if the current site is denied permissions to translate,
   * otherwise returns false.
   *
   * @returns {Promise<boolean>}
   */
  shouldNeverTranslateSite() {
    const perms = Services.perms;
    const permission = perms.getPermissionObject(
      this.browsingContext.currentWindowGlobal.documentPrincipal,
      TRANSLATIONS_PERMISSION,
      /* exactHost */ false
    );
    return permission?.capability === perms.DENY_ACTION;
  }

  didDestroy() {
    this.#isDestroyed = true;
  }
}

/**
 * State that affects the UI. Any of the state that gets set triggers a dispatch to update
 * the UI.
 */
class TranslationsLanguageState {
  /**
   * @param {TranslationsParent} actor
   * @param {LangTags | null} previousDetectedLanguages
   */
  constructor(actor, previousDetectedLanguages = null) {
    this.#actor = actor;
    this.#detectedLanguages = previousDetectedLanguages;
    this.dispatch();
  }

  /**
   * The data members for TranslationsLanguageState, see the getters for their
   * documentation.
   */

  /** @type {TranslationsParent} */
  #actor;

  /** @type {TranslationPair | null} */
  #requestedTranslationPair = null;

  /** @type {LangTags | null} */
  #detectedLanguages = null;

  /** @type {number} */
  #locationChangeId = -1;

  /** @type {null | TranslationErrors} */
  #error = null;

  #isEngineReady = false;

  /**
   * Dispatch anytime the language details change, so that any UI can react to it.
   */
  dispatch() {
    if (!TranslationsParent.isActiveLocation(this.#locationChangeId)) {
      // Do not dispatch as this location is not active.
      return;
    }

    const browser = this.#actor.browsingContext.top.embedderElement;
    if (!browser) {
      return;
    }
    const { CustomEvent } = browser.ownerGlobal;
    browser.dispatchEvent(
      new CustomEvent("TranslationsParent:LanguageState", {
        bubbles: true,
        detail: {
          detectedLanguages: this.#detectedLanguages,
          requestedTranslationPair: this.#requestedTranslationPair,
          error: this.#error,
          isEngineReady: this.#isEngineReady,
        },
      })
    );
  }

  /**
   * When a translation is requested, this contains the translation pair. This means
   * that the TranslationsChild should be creating a TranslationsDocument and keep
   * the page updated with the target language.
   *
   * @returns {TranslationPair | null}
   */
  get requestedTranslationPair() {
    return this.#requestedTranslationPair;
  }

  set requestedTranslationPair(requestedTranslationPair) {
    this.#error = null;
    this.#isEngineReady = false;
    this.#requestedTranslationPair = requestedTranslationPair;
    this.dispatch();
  }

  /**
   * The stored results for the detected languages.
   *
   * @returns {LangTags | null}
   */
  get detectedLanguages() {
    return this.#detectedLanguages;
  }

  set detectedLanguages(detectedLanguages) {
    this.#detectedLanguages = detectedLanguages;
    this.dispatch();
  }

  /**
   * This id represents the last location change that happened for this actor. This
   * allows the UI to disambiguate when there are races and out of order events that
   * are dispatched. Only the most up to date `locationChangeId` is used.
   *
   * @returns {number}
   */
  get locationChangeId() {
    return this.#locationChangeId;
  }

  set locationChangeId(locationChangeId) {
    this.#locationChangeId = locationChangeId;

    // When the location changes remove the previous error.
    this.#error = null;

    this.dispatch();
  }

  /**
   * The last error that occured during translation.
   */
  get error() {
    return this.#error;
  }

  set error(error) {
    this.#error = error;
    // Setting an error invalidates the requested translation pair.
    this.#requestedTranslationPair = null;
    this.#isEngineReady = false;
    this.dispatch();
  }

  /**
   * Stores when the translations engine is ready. The wasm and language files must
   * be downloaded, which can take some time.
   */
  get isEngineReady() {
    return this.#isEngineReady;
  }

  set isEngineReady(isEngineReady) {
    this.#isEngineReady = isEngineReady;
    this.dispatch();
  }
}
