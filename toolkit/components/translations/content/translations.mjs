/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

const { XPCOMUtils } = ChromeUtils.importESModule(
  "resource://gre/modules/XPCOMUtils.sys.mjs"
);

XPCOMUtils.defineLazyModuleGetters(lazy, {
  RemoteSettings: "resource://services-settings/remote-settings.js",
});

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.contentCache.logLevel",
    prefix: "Translations",
  });
});

/**
 * @type {AboutTranslation | undefined}
 */
let aboutTranslation;

/**
 * While the feature is in development, hide the feature behind a pref. See
 * browser/app/profile/firefox.js for the status of enabling this project.
 */
function updateEnabledState() {
  if (Services.prefs.getBoolPref("browser.translations.enable")) {
    aboutTranslation = new AboutTranslation();

    document
      .querySelector("title")
      .setAttribute("data-l10n-id", "about-translations-title");
    document.body.style.visibility = "visible";
  } else {
    aboutTranslation.destroy();
    aboutTranslation = undefined;

    document.querySelector("title").removeAttribute("data-l10n-id");
    document.body.style.visibility = "hidden";
    document.title = "about:translations";
  }
}

class AboutTranslation {
  worker = new Worker("chrome://global/content/translations/worker.js");
  messageId = 0;

  constructor() {
    const translationMessage = {
      messageID: this.messageId++,
      translatedParagraph: null,
      sourceParagraph: "This is some text to translate.",
      sourceLanguage: "en",
      targetLanguage: "es",
      tabId: null,
      frameId: null,
      origin: null,
      type: null,
    };

    this.worker.postMessage(["translate", [translationMessage]])

    this.worker.addEventListener("message", this.onMessage);
  }

  destroy() {
    this.worker.removeEventListener("message", this.onMessage);
  }

  /**
   * @param {MessageEvent} event
   */
  onMessage = (event) => {
    const [name, ...args] = event.data;
    lazy.console.log(`worker.js message`, name, args);

    switch (name) {
      case "reportPerformanceTimespan": {
        // TODO(Telemetry)

        /** @type {"model_load_time_num"} */
        const perfType = args[0];

        /** @type {number} */
        const elapsedMS = args[1];
        break;
      }

      case "reportException": {
        // TODO(Telemetry) - In the addon this uses Sentry. Firefox currently cannot
        // capture stacks, but potentially could. The addon uses some complicated
        // tricks to serialize the Error message.
        //
        // See https://bugzilla.mozilla.org/show_bug.cgi?id=1728784

        /** @type {string} */
        const errorMessage = args[0];
        break;
      }

      case "updateProgress": {
        /**
        @type {
           "loadingTranslationEngine"
           | "errorLoadingWasm"
           | "translationLoadedWithErrors"
           | "translationEnabledNoOT"
           | "translationEnabled"
           | "translationLoadedWithErrors"
           | ["translationProgress", string]
         }
         */
        const progress = args[0];
        break;
      }

      case "reportError": {
        /**
         @type {
          "engine_download"
          | "engine_load"
          | "engine_load"
          | "translation"
          | "model_load"
          | "marian"
         }
         */
         const error = data
         // TODO(Telemetry) - This is a specific error.
        break;
      }

      case "translationComplete": {
        /**
         * The translated message.
         * @type {string}
         */
        const message = args[0];

        /**
         * A tuple of total words, and milliseconds elapsed.
         * @type {[number, number]}
         */
        const timeElapsed = args[1];
        break;
      }

      case "downloadLanguageModels": {
        /**
         * @type {Array<{ name: string, withQualityEstimation: boolean }}
         */
        const languagePairs = args[0];
        for (const { name } of languagePairs) {
          // TODO - Download language models.

        }
        break;
      }

      case "displayOutboundTranslation": {
        // TODO - Remove me. This displays the widget to translate forms which has
        // no immediate plans of being yused.

        /** @type {null} */
        const unknown = args[0];
        break;
      }

      case "reportQeIsSupervised": {
        // TODO(Telemetry) This seems like it doesn't need to go through message passing
        // perhaps this can be simplified to the UI layer.

        // Reports on quality estimation whether or not it is supervised.
        /** @type {boolean} */
        const isSupervised = args[0];
        break;
      }
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  updateEnabledState();
  Services.prefs.addObserver("browser.translations.enable", updateEnabledState);
});

TranslationsChild
