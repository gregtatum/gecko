/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const EXPORTED_SYMBOLS = ["AboutWelcomeDefaults", "DEFAULT_WELCOME_CONTENT"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  AddonRepository: "resource://gre/modules/addons/AddonRepository.jsm",
  AppConstants: "resource://gre/modules/AppConstants.jsm",
  AttributionCode: "resource:///modules/AttributionCode.jsm",
  Services: "resource://gre/modules/Services.jsm",
});

const DEFAULT_WELCOME_CONTENT = {
  id: "DEFAULT_ABOUTWELCOME_PROTON",
  template: "multistage",
  transitions: true,
  background_url:
    "chrome://activity-stream/content/data/content/assets/proton-bkg.avif",
  screens: [
    {
      id: "AW_PIN_FIREFOX",
      order: 0,
      content: {
        title: {
          string_id: "mr1-onboarding-pin-header",
        },
        hero_text: {
          string_id: "mr1-welcome-screen-hero-text",
        },
        help_text: {
          text: {
            string_id: "mr1-onboarding-welcome-image-caption",
          },
        },
        primary_button: {
          label: {
            string_id: "mr1-onboarding-pin-primary-button-label",
          },
          action: {
            navigate: true,
            type: "PIN_FIREFOX_TO_TASKBAR",
          },
        },
        secondary_button: {
          label: {
            string_id: "mr1-onboarding-set-default-secondary-button-label",
          },
          action: {
            navigate: true,
          },
        },
        secondary_button_top: {
          label: {
            string_id: "mr1-onboarding-sign-in-button-label",
          },
          action: {
            data: {
              entrypoint: "activity-stream-firstrun",
            },
            type: "SHOW_FIREFOX_ACCOUNTS",
            addFlowParams: true,
          },
        },
      },
    },
    {
      id: "AW_SET_DEFAULT",
      order: 1,
      content: {
        title: {
          string_id: "mr1-onboarding-default-header",
        },
        subtitle: {
          string_id: "mr1-onboarding-default-subtitle",
        },
        primary_button: {
          label: {
            string_id: "mr1-onboarding-default-primary-button-label",
          },
          action: {
            navigate: true,
            type: "SET_DEFAULT_BROWSER",
          },
        },
        secondary_button: {
          label: {
            string_id: "mr1-onboarding-set-default-secondary-button-label",
          },
          action: {
            navigate: true,
          },
        },
      },
    },
    {
      id: "AW_LANGUAGE_MISMATCH",
      order: 2,
      content: {
        title: {
          string_id: "onboarding-live-language-header",
        },
        subtitle: {
          string_id: "onboarding-live-language-subtitle",
          // These need to be looked up:
          args: {
            systemLanguage: null,
            appLanguage: null,
          },
        },
        tiles: {
          type: "language",
          label: {
            string_id: "onboarding-live-language-primary-button-label",
            // These need to be looked up:
            args: {
              systemLanguage: null,
            },
          },
          action: {
            type: "SWITCH_TO_OS_LANGUAGE",
            data: {
              requestSystemLocales: null,
            },
            navigate: true,
          },
          langPack: null,
        },
        secondary_button: {
          label: {
            string_id: "onboarding-live-language-secondary-button-label",
          },
          action: {
            navigate: true,
          },
        },
      },
    },
    {
      id: "AW_IMPORT_SETTINGS",
      order: 3,
      content: {
        title: {
          string_id: "mr1-onboarding-import-header",
        },
        subtitle: {
          string_id: "mr1-onboarding-import-subtitle",
        },
        primary_button: {
          label: {
            string_id:
              "mr1-onboarding-import-primary-button-label-no-attribution",
          },
          action: {
            type: "SHOW_MIGRATION_WIZARD",
            data: {},
            navigate: true,
          },
        },
        secondary_button: {
          label: {
            string_id: "mr1-onboarding-import-secondary-button-label",
          },
          action: {
            navigate: true,
          },
        },
      },
    },
    {
      id: "AW_CHOOSE_THEME",
      order: 4,
      content: {
        title: {
          string_id: "mr1-onboarding-theme-header",
        },
        subtitle: {
          string_id: "mr1-onboarding-theme-subtitle",
        },
        tiles: {
          type: "theme",
          action: {
            theme: "<event>",
          },
          data: [
            {
              theme: "automatic",
              label: {
                string_id: "mr1-onboarding-theme-label-system",
              },
              tooltip: {
                string_id: "mr1-onboarding-theme-tooltip-system",
              },
              description: {
                string_id: "mr1-onboarding-theme-description-system",
              },
            },
            {
              theme: "light",
              label: {
                string_id: "mr1-onboarding-theme-label-light",
              },
              tooltip: {
                string_id: "mr1-onboarding-theme-tooltip-light",
              },
              description: {
                string_id: "mr1-onboarding-theme-description-light",
              },
            },
            {
              theme: "dark",
              label: {
                string_id: "mr1-onboarding-theme-label-dark",
              },
              tooltip: {
                string_id: "mr1-onboarding-theme-tooltip-dark",
              },
              description: {
                string_id: "mr1-onboarding-theme-description-dark",
              },
            },
            {
              theme: "alpenglow",
              label: {
                string_id: "mr1-onboarding-theme-label-alpenglow",
              },
              tooltip: {
                string_id: "mr1-onboarding-theme-tooltip-alpenglow",
              },
              description: {
                string_id: "mr1-onboarding-theme-description-alpenglow",
              },
            },
          ],
        },
        primary_button: {
          label: {
            string_id: "mr1-onboarding-theme-primary-button-label",
          },
          action: {
            navigate: true,
          },
        },
        secondary_button: {
          label: {
            string_id: "mr1-onboarding-theme-secondary-button-label",
          },
          action: {
            theme: "automatic",
            navigate: true,
          },
        },
      },
    },
  ],
};

async function getAddonFromRepository(data) {
  const [addonInfo] = await AddonRepository.getAddonsByIDs([data]);
  if (addonInfo.sourceURI.scheme !== "https") {
    return null;
  }
  return {
    name: addonInfo.name,
    url: addonInfo.sourceURI.spec,
    iconURL: addonInfo.icons["64"] || addonInfo.icons["32"],
    type: addonInfo.type,
    themePreviewInfo: addonInfo.previews,
  };
}

async function getAddonInfo(attrbObj) {
  let { content, source } = attrbObj;
  try {
    if (!content || source !== "addons.mozilla.org") {
      return null;
    }
    // Attribution data can be double encoded
    while (content.includes("%")) {
      try {
        const result = decodeURIComponent(content);
        if (result === content) {
          break;
        }
        content = result;
      } catch (e) {
        break;
      }
    }
    // return_to_amo embeds the addon id in the content
    // param, prefixed with "rta:".  Translating that
    // happens in AddonRepository, however we can avoid
    // an API call if we check up front here.
    if (content.startsWith("rta:")) {
      return await getAddonFromRepository(content);
    }
  } catch (e) {
    Cu.reportError("Failed to get the latest add-on version for Return to AMO");
  }
  return null;
}

async function getAttributionContent() {
  let attribution = await AttributionCode.getAttrDataAsync();
  if (attribution?.source === "addons.mozilla.org") {
    let addonInfo = await getAddonInfo(attribution);
    if (addonInfo) {
      return {
        ...addonInfo,
        template: "return_to_amo",
      };
    }
  }
  if (attribution?.ua) {
    return {
      ua: decodeURIComponent(attribution.ua),
    };
  }
  return null;
}

// Return default multistage welcome content
function getDefaults() {
  return Cu.cloneInto(DEFAULT_WELCOME_CONTENT, {});
}

let gSourceL10n = null;

// Localize Firefox download source from user agent attribution to show inside
// import primary button label such as 'Import from <localized browser name>'.
// no firefox as import wizard doesn't show it
const allowedUAs = ["chrome", "edge", "ie"];
function getLocalizedUA(ua) {
  if (!gSourceL10n) {
    gSourceL10n = new Localization(["browser/migration.ftl"]);
  }
  if (allowedUAs.includes(ua)) {
    return gSourceL10n.formatValue(`source-name-${ua.toLowerCase()}`);
  }
  return null;
}

/**
 * In telemetry data, some of the system locales show up as blank. Guard against this
 * and any other malformed locale information provided by the system by wrapping the call
 * into a catch/try.
 *
 * @param {string} locale
 * @returns {Intl.Locale | null}
 */
function getStructuredLocaleOrNull(localeString) {
  try {
    return new Services.intl.Locale(localeString);
  } catch (_err) {
    return null;
  }
}

/**
 * A seralized Intl.Locale.
 *
 * @typedef SerializedLocale
 * @type {object}
 * @property {string} baseName
 * @property {string} language
 * @property {string} region
 */
/**
 * @returns {{
 *  systemLocale: SerializedLocale,
 *  appLocale: SerializedLocale,
 *  matchType: "unknown" | "language-mismatch" | "region-mismatch" | "match",
 * }}
 */
function getAppAndSystemLocaleInfo() {
  const osPrefs = Cc["@mozilla.org/intl/ospreferences;1"].getService(
    Ci.mozIOSPreferences
  );

  // Convert locale strings into structured locale objects.
  const systemLocaleRaw = osPrefs.systemLocale;
  const appLocaleRaw = Services.locale.appLocaleAsBCP47;
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

  return {
    // Return the Intl.Locale in a serializable form.
    systemLocaleRaw,
    systemLocale,
    appLocaleRaw,
    appLocale,
    matchType,
  };
}

/**
 * Attempts to find an appropriate langpack for a given language. The async function
 * is infallible, but may not return a langpack.
 *
 * @returns {LangPack | null}
 */
async function negotiateLangPackForLanguageMismatch(localeInfo) {
  console.log(
    "AboutWelcomeDefaults.jsm - negotiateLangPackForLanguageMismatch"
  );

  /**
   * Fetch the available langpacks from AMO.
   *
   * @type {Array<LangPack>}
   */
  let availableLangpacks;

  try {
    availableLangpacks = await AddonRepository.getAvailableLangpacks();
  } catch (error) {
    Cu.reportError(
      `Failed to get the list of available language packs: ${error?.message}`
    );
    return null;
  }
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

async function prepareContentForReact(content) {
  if (content?.template === "return_to_amo") {
    return content;
  }

  // Helper to find screens to remove and adjust screen order.
  function removeScreens(check) {
    const { screens } = content;
    let removed = 0;
    for (let i = 0; i < screens?.length; i++) {
      if (check(screens[i])) {
        screens.splice(i--, 1);
        removed++;
      } else if (screens[i].order) {
        screens[i].order -= removed;
      }
    }
  }

  // Change content for Windows 7 because non-light themes aren't quite right.
  if (AppConstants.isPlatformAndVersionAtMost("win", "6.1")) {
    removeScreens(screen => ["theme"].includes(screen.content?.tiles?.type));
  }

  // Set the primary import button source based on attribution.
  if (content?.ua) {
    // If available, add the browser source to action data
    // and localized browser string args to primary button label
    const { label, action } =
      content?.screens?.find(
        screen =>
          screen?.content?.primary_button?.action?.type ===
          "SHOW_MIGRATION_WIZARD"
      )?.content?.primary_button ?? {};

    if (action) {
      action.data = { ...action.data, source: content.ua };
    }

    let browserStr = await getLocalizedUA(content.ua);

    if (label?.string_id) {
      label.string_id = browserStr
        ? "mr1-onboarding-import-primary-button-label-attribution"
        : "mr1-onboarding-import-primary-button-label-no-attribution";

      label.args = browserStr ? { previous: browserStr } : {};
    }
  }

  // If already pinned, convert "pin" screen to "welcome" with desired action.
  let removeDefault = !content.needDefault;
  if (!content.needPin) {
    const pinScreen = content.screens?.find(screen =>
      screen.id?.startsWith("AW_PIN_FIREFOX")
    );
    if (pinScreen?.content) {
      pinScreen.id = removeDefault ? "AW_GET_STARTED" : "AW_ONLY_DEFAULT";
      pinScreen.content.title = {
        string_id: "mr1-onboarding-welcome-header",
      };
      pinScreen.content.primary_button = {
        label: {
          string_id: removeDefault
            ? "mr1-onboarding-get-started-primary-button-label"
            : "mr1-onboarding-set-default-only-primary-button-label",
        },
        action: {
          navigate: true,
        },
      };

      // Get started content will navigate without action, so remove "Not now."
      if (removeDefault) {
        delete pinScreen.content.secondary_button;
      } else {
        // The "pin" screen will now handle "default" so remove other "default."
        pinScreen.content.primary_button.action.type = "SET_DEFAULT_BROWSER";
        removeDefault = true;
      }
    }
  }
  if (removeDefault) {
    removeScreens(screen => screen.id?.startsWith("AW_SET_DEFAULT"));
  }

  // Remove Firefox Accounts related UI and prevent related metrics.
  if (!Services.prefs.getBoolPref("identity.fxaccounts.enabled", false)) {
    delete content.screens?.find(
      screen =>
        screen.content?.secondary_button_top?.action?.type ===
        "SHOW_FIREFOX_ACCOUNTS"
    )?.content.secondary_button_top;
    content.skipFxA = true;
  }

  // Remove the English-only image caption.
  if (Services.locale.appLocaleAsBCP47.split("-")[0] !== "en") {
    delete content.screens?.find(
      screen => screen.content?.help_text?.deleteIfNotEn
    )?.content.help_text.text;
  }

  const localeInfo = getAppAndSystemLocaleInfo();
  let showLiveLanguage = false;
  if (
    // This is using a pref rather than Nimbus as only ~5% of users will be affected
    // and there is no need to roll out the feature. It is being developed under
    // a flag to allow easy enabling when the features are ready.
    Services.prefs.getBoolPref(
      "intl.multilingual.aboutWelcome.languageMismatchEnabled"
    ) &&
    localeInfo.matchType === "language-mismatch"
  ) {
    const langPack = await negotiateLangPackForLanguageMismatch(localeInfo);
    if (langPack) {
      // Convert the BCP 47 identifiers into the proper display names.
      // e.g. "fr-CA" -> "Canadian French".
      const displayNames = new Services.intl.DisplayNames(
        Services.locale.appLocaleAsBCP47,
        { type: "language" }
      );
      const systemLanguage = displayNames.of(localeInfo.systemLocale.baseName);
      const appLanguage = displayNames.of(localeInfo.appLocale.baseName);

      const screen = content.screens.find(
        ({ id }) => id === "AW_LANGUAGE_MISMATCH"
      );
      const { subtitle, tiles } = screen.content;

      subtitle.args.systemLanguage = systemLanguage;
      subtitle.args.appLanguage = appLanguage;
      tiles.label.args.systemLanguage = systemLanguage;
      tiles.langPack = langPack;
      tiles.action.data.requestSystemLocales = [
        langPack.target_locale,
        localeInfo.appLocaleRaw,
      ];

      showLiveLanguage = true;
    }
  }

  if (!showLiveLanguage) {
    console.log("Remove screen.");
    removeScreens(screen => screen.id === "AW_LANGUAGE_MISMATCH");
  }

  return content;
}

const AboutWelcomeDefaults = {
  prepareContentForReact,
  getDefaults,
  getAttributionContent,
};
