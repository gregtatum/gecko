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
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

/**
 * The JSON details about the attachment
 *
 * @typedef {Object} Attachment
 *
 * @prop {string} hash -     e.g. "2f7c0f7bbc...ca79f0850c4de",
 * @prop {string} size -     e.g. 5047568,
 * @prop {string} filename - e.g. "lex.50.50.deen.s2t.bin",
 * @prop {string} location - e.g. "main-workspace/translations-models/316ebb3a-0682-42cc-8e73-a3ba4bbb280f.bin",
 * @prop {string} mimetype - e.g. "application/octet-stream"
 */

/**
 * The JSON that is synced from RemoteSettings for the translation models.
 *
 * @typedef {Object} Model
 *
 * @prop {string} name - The model name  e.g. "lex.50.50.deen.s2t.bin"
 * @prop {string} fromLang -             e.g. "de"
 * @prop {string} toLang -               e.g. "en"
 * @prop {number} version -              e.g. 1
 * @prop {string} fileType -             e.g. "lex"
 * @prop {string} attachment -           e.g. Attachment
 * @prop {string} id -                   e.g. "0d4db293-a17c-4085-9bd8-e2e146c85000"
 * @prop {number} schema -               e.g. 1673023100578
 * @prop {string} last_modified -        e.g. 1673455932527
 */

/**
 * @type {TranslationsState | undefined}
 */
let translationsState;

/**
 * While the feature is in development, hide the feature behind a pref. See
 * browser/app/profile/firefox.js for the status of enabling this project.
 */
function updateEnabledState() {
  if (Services.prefs.getBoolPref("browser.translations.enable")) {
    translationsState = new TranslationsState();

    lazy.console.log("Translation state initialized", translationsState);

    document
      .querySelector("title")
      .setAttribute("data-l10n-id", "about-translations-title");
    document.body.style.visibility = "visible";
  } else {
    translationsState?.destroy();
    translationsState = undefined;

    document.querySelector("title").removeAttribute("data-l10n-id");
    document.body.style.visibility = "hidden";
    document.title = "about:translations";
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
    this.initiateDropdowns();
    this.state.remoteModels.then(this.uiReady.bind(this));
  }

  uiReady() {
    this.translationTo.classList.remove("about-translations-input-results-loading");
  }

  /**
   * Once the models have been synced from remote settings, populate them with the display
   * names of the languages.
   */
  async initiateDropdowns() {
    // Update the DOM elements with the display names.
    for (const {langTag, displayName} of await this.state.getSupportedLanguages()) {
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
    const appLocale = new Services.intl.Locale(Services.locale.appLocaleAsBCP47);
    for (const option of this.languageFrom.options) {
      if (option.value === appLocale.language) {
        this.languageFrom.value = option.value;
        break;
      }
    }

    // Finally enable the controls.
    this.languageFrom.disabled = false;
    this.languageTo.disabled = false;

    // Focus the language dropdowns if they are empty.
    if (this.languageFrom.value == "") {
      this.languageFrom.focus();
    } else if (this.languageTo.value == "") {
      this.languageTo.focus();
    }
  }
}

/**
 * The model and controller for initializing about:translations.
 */
class TranslationsState {
  worker = new Worker("chrome://global/content/translations/worker.js");
  messageId = 0;

  /** @type {Promise<Model[]>} */
  remoteModels;

  /** @type {TranslationsUI} */
  ui;

  /** @type {RemoteSettingsClient} */
  translationsModels;

  constructor() {
    this.translationsModels = lazy.RemoteSettings("translations-models");
    this.remoteModels = TranslationsState.setupRemoteModels(this.translationsModels);
    this.ui = new TranslationsUI(this);

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

    this.worker.addEventListener("message", this.onMessage);
    this.worker.postMessage(["translate", [translationMessage]]);
  }

  destroy() {
    this.worker.removeEventListener("message", this.onMessage);
  }

  /**
   * @param {RemoteSettingsClient} remoteModels
   * @returns {Models}
   */
  static async setupRemoteModels(remoteModels) {
    // DO NOT LAND!!
    // The signatures were broken on the Dev server.
    remoteModels.verifySignature = false;

    remoteModels.on("sync", async ({ data: { created, updated, deleted } }) => {
      lazy.console.log(`"sync" event for remote models `, { created, updated, deleted });

      // Remove local attachments of remotely deleted records.
      await Promise.all(
        deleted.map(async record => {
          if (record.attachment) {
            await remoteModels.attachments.deleteDownloaded(record);
          }
        })
      );

      const newRecords = [...created, update.map(record => record.new)];

      // Download new attachments
      await Promise.all(
        newRecords.map(async record => {
          // const { buffer } = await client.attachments.download(record);
        })
      );
    });

    try {
      await remoteModels.sync();
    } catch (error) {
      // TODO - Update the UI with errors.
      lazy.console.error(`Syncing the remote models failed`, error);
    }

    const models = await remoteModels.get();
    console.log(`Models loaded`, models);
    return models
  }

  /**
   * @param {MessageEvent} event
   */
  onMessage = event => {
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
        const error = data;
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
          // downloadModel(name);
        }
        break;
      }

      case "displayOutboundTranslation": {
        // TODO - Remove me. This displays the widget to translate forms which has
        // no immediate plans of being used.

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
  };

  /**
   * Get the list of languages and their display names, sorted by their display names.
   *
   * @returns {Promise<Array<{ langTag: string, displayName }>>}
   */
  async getSupportedLanguages() {
    const languages = new Set();
    for (const model of await this.remoteModels) {
      languages.add(model.fromLang);
    }

    const displayNames = new Services.intl.DisplayNames(undefined, { type: "language" });

    return [...languages]
      .map(langTag => ({
        langTag,
        displayName: displayNames.of(langTag)
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }
}

window.addEventListener("DOMContentLoaded", () => {
  updateEnabledState();
  Services.prefs.addObserver("browser.translations.enable", updateEnabledState);
});
