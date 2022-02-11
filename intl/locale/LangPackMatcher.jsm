/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

console.log("!!! In LangPackMatcher.jsm");

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  AddonRepository: "resource://gre/modules/addons/AddonRepository.jsm",
  AddonManager: "resource://gre/modules/AddonManager.jsm",
  Services: "resource://gre/modules/Services.jsm",
  setTimeout: "resource://gre/modules/Timer.jsm",
});

if (Services.appinfo.processType !== Services.appinfo.PROCESS_TYPE_DEFAULT) {
  // This check ensures that the `mockable` API calls can be consisently mocked in tests.
  // If this requirement needs to be eased, please ensure the test logic remains valid.
  throw new Error("This code is assumed to run in the parent process.");
}

/**
 * Attempts to find an appropriate langpack for a given language. The async function
 * is infallible, but may not return a langpack.
 *
 * @returns {LangPack | null}
 */
async function negotiateLangPackForLanguageMismatch() {
  const localeInfo = getAppAndSystemLocaleInfo();

  /**
   * Fetch the available langpacks from AMO.
   *
   * @type {Array<LangPack>}
   */

  let countdown = 0;
  for (let i = countdown; i > 0; i--) {
    dump(`LangPackMatcher.jsm - negotiateLangPackForLanguageMismatch ${i}\n`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  dump("LangPackMatcher.jsm - negotiateLangPackForLanguageMismatch done\n");

  const availableLangpacks = await mockable.getAvailableLangpacks();
  if (!availableLangpacks) {
    return null;
  }

  /**
   * Figure out a langpack to recommend.
   * @type {LangPack | null}
   */
  return (
    // First look for a langpack that matches the baseName.
    // e.g. system "fr-FR" matches langpack "fr-FR"
    //      system "en-GB" matches langpack "en-GB".
    availableLangpacks.find(
      ({ target_locale }) => target_locale === localeInfo.systemLocale.baseName
    ) ||
    // Next look for langpacks that just match the language.
    // e.g. system "fr-FR" matches langpack "fr".
    //      system "en-AU" matches langpack "en".
    availableLangpacks.find(
      ({ target_locale }) => target_locale === localeInfo.systemLocale.language
    ) ||
    // Next look for a langpack that matches the language, but not the region.
    // e.g. "es-CL" (Chilean Spanish) as a system language matching
    //      "en-ES" (European Spanish)
    availableLangpacks.find(({ target_locale }) =>
      target_locale.startsWith(`${localeInfo.systemLocale.language}-`)
    )
  );
}

// If a langpack is being installed, allow blocking on that.
let installingLangpack = new Map();

/**
 * @typedef {LangPack}
 * @type {object}
 * @property {string} target_locale
 * @property {string} url
 * @property {string} hash
 */

/**
 * Ensure that a given lanpack is installed.
 *
 * @param {LangPack} langPack
 * @returns {boolean} Success or failure.
 */
function ensureLangPackInstalled(langPack) {
  // Make sure any outstanding calls get resolved before attempting another call.
  // This guards against any quick page refreshes attempting to install the langpack
  // twice.
  const inProgress = installingLangpack.get(langPack.hash);
  if (inProgress) {
    return inProgress;
  }
  const promise = _ensureLangPackInstalledImpl(langPack);
  installingLangpack.set(langPack.hash, promise);
  promise.finally(() => {
    installingLangpack.delete(langPack.hash);
  });
  return promise;
}

/**
 * @param {LangPack} langPack
 * @returns {boolean} Success or failure.
 */
async function _ensureLangPackInstalledImpl(langPack) {
  dump(
    `!!! LangPackMatcher.jsm - ensureLangPackInstalled ${JSON.stringify(
      langPack
    )}\n`
  );
  {
    const seconds = 0;
    const message = "_ensureLangPackInstalledImpl";
    for (let i = seconds; i > 0; i--) {
      dump(`!!! Countdown - ${message} ${i}
  `);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    dump(`!!! Countdown ${message} done.`);
  }
  dump("LangPackMatcher.jsm - _ensureLangPackInstalledImpl done\n");
  if (mockable.getAvailableLocales().includes(langPack.target_locale)) {
    // The langpack is already installed.
    return true;
  }

  return mockable.installLangPack(langPack);
}

/**
 * These are all functions with side effects or configuration options that should be
 * mockable for tests.
 */
const mockable = {
  /**
   * @returns {LangPack[] | null}
   */
  async getAvailableLangpacks() {
    {
      const seconds = 0;
      const message = "";
      for (let i = seconds; i > 0; i--) {
        dump(`!!! Countdown - ${message} ${i}
    `);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      dump(`!!! Countdown ${message} done.`);
    }

    try {
      return AddonRepository.getAvailableLangpacks();
    } catch (error) {
      Cu.reportError(
        `Failed to get the list of available language packs: ${error?.message}`
      );
      return null;
    }
  },

  /**
   * Use the AddonManager to install an addon from the URL.
   * @param {LangPack} langPack
   */
  async installLangPack(langPack) {
    let install;
    console.log("!!! installLangPack", langPack);
    {
      const seconds = 10;
      const message = "installLangPack";
      for (let i = seconds; i > 0; i--) {
        dump(`!!! Countdown - ${message} ${i}
    `);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      dump(`!!! Countdown ${message} done.`);
    }
    try {
      install = await AddonManager.getInstallForURL(langPack.url, {
        hash: langPack.hash,
        telemetryInfo: {
          source: "about:welcome",
        },
      });
    } catch (error) {
      Cu.reportError(error);
      return false;
    }

    try {
      await install.install();
    } catch (error) {
      Cu.reportError(error);
      return false;
    }
    return true;
  },

  /**
   * @returns {string[]}
   */
  getAvailableLocales() {
    return Services.locale.availableLocales;
  },

  /**
   * @returns {string}
   */
  getAppLocaleAsBCP47() {
    return Services.locale.appLocaleAsBCP47;
  },

  /**
   * @returns {string}
   */
  getSystemLocale() {
    const osPrefs = Cc["@mozilla.org/intl/ospreferences;1"].getService(
      Ci.mozIOSPreferences
    );
    return osPrefs.systemLocale;
  },

  /**
   * @param {string[]} locals The BCP 47 locale identifiers.
   */
  setRequestedAppLocales(locales) {
    Services.locale.requestedLocales = locales;
  },
};

/**
 * This function is really only setting `Services.locale.requestedLocales`, but it's
 * using the `mockable` object to allow this behavior to be mocked in tests.
 *
 * @param {string[]} locals The BCP 47 locale identifiers.
 */
function setRequestedAppLocales(locales) {
  mockable.setRequestedAppLocales(locales);
}

/**
 * A seralized Intl.Locale.
 *
 * @typedef StructuredLocale
 * @type {object}
 * @property {string} baseName
 * @property {string} language
 * @property {string} region
 */

/**
 * In telemetry data, some of the system locales show up as blank. Guard against this
 * and any other malformed locale information provided by the system by wrapping the call
 * into a catch/try.
 *
 * @param {string} locale
 * @returns {StructuredLocale | null}
 */
function getStructuredLocaleOrNull(localeString) {
  try {
    const locale = new Services.intl.Locale(localeString);
    return {
      baseName: locale.baseName,
      language: locale.language,
      region: locale.region,
    };
  } catch (_err) {
    return null;
  }
}

/**
 * @returns {{
 *  systemLocale: SerializedLocale,
 *  appLocale: SerializedLocale,
 *  matchType: "unknown" | "language-mismatch" | "region-mismatch" | "match",
 * }}
 */
function getAppAndSystemLocaleInfo() {
  // Convert locale strings into structured locale objects.
  const systemLocaleRaw = mockable.getSystemLocale();
  const appLocaleRaw = mockable.getAppLocaleAsBCP47();

  const systemLocale = getStructuredLocaleOrNull(systemLocaleRaw);
  const appLocale = getStructuredLocaleOrNull(appLocaleRaw);

  let matchType = "unknown";
  if (systemLocale && appLocale) {
    if (systemLocale.language !== appLocale.language) {
      matchType = "language-mismatch";
    } else if (systemLocale.region !== appLocale.region) {
      matchType = "region-mismatch";
    } else {
      matchType = "match";
    }
  }

  const displayNames = new Services.intl.DisplayNames(appLocaleRaw, {
    type: "language",
  });

  return {
    // Return the Intl.Locale in a serializable form.
    systemLocaleRaw,
    systemLocale,
    appLocaleRaw,
    appLocale,
    matchType,

    // These can be used as Fluent message args.
    displayNames: {
      systemLanguage: displayNames.of(systemLocale.baseName),
      appLanguage: displayNames.of(appLocale.baseName),
    },
  };
}

var LangPackMatcher = {
  negotiateLangPackForLanguageMismatch,
  ensureLangPackInstalled,
  getAppAndSystemLocaleInfo,
  setRequestedAppLocales,
  mockable,
};

var EXPORTED_SYMBOLS = ["LangPackMatcher"];
