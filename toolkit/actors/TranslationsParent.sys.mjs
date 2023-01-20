/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The pivot language is used to pivot between two different language translations
 * when there is not a language between. In this case "en" is common between the
 * various supported models.
 *
 * For instance given the following two models:
 *   "fr" -> "en"
 *   "en" -> "it"
 *
 * You can accomplish:
 *   "fr" -> "it"
 *
 * By doing:
 *   "fr" -> "en" -> "it"
 */
const PIVOT_LANGUAGE = "en";

const lazy = {};

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

XPCOMUtils.defineLazyModuleGetters(lazy, {
  RemoteSettings: "resource://services-settings/remote-settings.js",
});

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations [parent]",
  });
});

/**
 * The client to interact with RemoteSettings.
 *
 * @typedef {Object} RemoteSettingsClient
 * @prop {Function} on
 * @prop {Function} get
 * @prop {any} attachments
 */

/**
 * The JSON that is synced from Remote Settings for the translation models.
 * @typedef {Object} ModelRecord
 * @prop {string} name - The model name  e.g. "lex.50.50.deen.s2t.bin"
 * @prop {string} fromLang - e.g. "de"
 * @prop {string} toLang - e.g. "en"
 * @prop {number} version - e.g. 1
 * @prop {string} fileType - e.g. "lex"
 * @prop {string} attachment - e.g. Attachment
 * @prop {string} id - e.g. "0d4db293-a17c-4085-9bd8-e2e146c85000"
 * @prop {number} schema - e.g. 1673023100578
 * @prop {string} last_modified - e.g. 1673455932527
 */

/**
 * TODO - The translations actor will eventually be used to handle in-page translations
 * See Bug 971044
 */
export class TranslationsParent extends JSWindowActorParent {
  /**
   * A map of the ModelRecord["id"] to the record of the model in Remote Settings.
   * Used to coordinate the downloads. See `getLanguagePair`
   *
   * @type {Map<string, ModelRecord>}
   */
  #modelRecords = new Map();

  /** @type {RemoteSettingsClient | null} */
  #modelsRemoteClient = null;

  /** @type {RemoteSettingsClient | null} */
  #wasmRemoteClient = null;

  async receiveMessage({ name, data }) {
    switch (name) {
      case "Translations:GetBergmotWasmArrayBuffer": {
        return this.#getBergmotWasmArrayBuffer();
      }
      case "Translations:GetTranslationModels": {
        const { fromLanguage, toLanguage } = data;
        const buffers = await this.getLanguageModelBuffers(
          fromLanguage,
          toLanguage
        );
        if (buffers) {
          // No pivoting is required.
          return [buffers];
        }
        // No matching model was found, try to pivot between English.
        const [buffer1, buffer2] = await Promise.all([
          this.getLanguageModelBuffers(fromLanguage, PIVOT_LANGUAGE),
          this.getLanguageModelBuffers(PIVOT_LANGUAGE, toLanguage),
        ]);
        if (!buffer1 || !buffer2) {
          throw new Error(
            `No language models were found for ${fromLanguage} to ${toLanguage}`
          );
        }
        return [buffer1, buffer2];
      }
      case "Translations:GetSupportedLanguages": {
        return this.#getSupportedLanguages();
      }
    }
    return undefined;
  }

  /**
   * Get the list of languages and their display names, sorted by their display names.
   *
   * @returns {Promise<Array<{ langTag: string, displayName }>>}
   */
  async #getSupportedLanguages() {
    const languages = new Set();
    for (const { fromLang } of (await this.#getModelRecords()).values()) {
      languages.add(fromLang);
    }

    const displayNames = new Services.intl.DisplayNames(undefined, {
      type: "language",
    });

    return [...languages]
      .map(langTag => ({
        langTag,
        displayName: displayNames.of(langTag),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  /**
   * Lazily initializes the RemoteSettingsClient for the language models.
   *
   * @returns {RemoteSettingsClient}
   */
  #getModelsRemoteClient() {
    if (this.#modelsRemoteClient) {
      return this.#modelsRemoteClient;
    }

    /** @type {RemoteSettingsClient} */
    const client = lazy.RemoteSettings("translations-models");

    // DO NOT LAND! This is working around a bug in Remote Settings dev server.
    client.verifySignature = false;

    client.on("sync", async ({ data: { created, updated, deleted } }) => {
      // Language model attachments will only be downloaded when they are used.
      lazy.console.log(
        `Remote Settings "sync" event for remote language models `,
        {
          created,
          updated,
          deleted,
        }
      );

      // Remove all the deleted records.
      for (const record of deleted) {
        await client.attachments.deleteDownloaded(record);
        this.#modelRecords.delete(record.id);
      }

      // Pre-emptively remove the old downloads, and set the new updated record.
      for (const { old: oldRecord, new: newRecord } of updated) {
        await client.attachments.deleteDownloaded(oldRecord);
        // The language pairs should be the same on the update, but use the old
        // record just in case.
        this.#modelRecords.delete(oldRecord.id);
        this.#modelRecords.set(newRecord.id, newRecord);
      }

      // Add the new records, but don't download any attachments.
      for (const record of created) {
        this.#modelRecords.set(record.id, record);
      }
    });

    return client;
  }

  /**
   * Lazily initializes the model records, and returns the cached ones if they
   * were already retrieved.
   *
   * @returns {Promise<Map<string, ModelRecord>>}
   */
  async #getModelRecords() {
    if (this.#modelRecords.size > 0) {
      return this.#modelRecords;
    }

    const client = this.#getModelsRemoteClient();

    // Load the models. If no data is present, then there will be an initial sync.
    // Rely on Remote Settings for the syncing strategy for receiving updates.
    lazy.console.log(`Getting remote language models.`);

    /** @type {ModelRecord[]} */
    const records = await client.get({
      // Pull the records from the network so that we never get an empty list.
      syncIfEmpty: true,
      // TODO - We should consider the verification process. For now do the slow/safe
      // thing of always verifying the signature.
      verifySignature: true,
    });

    for (const modelRecord of records) {
      this.#modelRecords.set(modelRecord.id, modelRecord);
    }

    lazy.console.log(`Remote language models loaded.`, records);

    return this.#modelRecords;
  }

  /**
   * Lazily initializes the RemoteSettingsClient for the downloaded wasm binary data.
   *
   * @returns {RemoteSettingsClient}
   */
  #getWasmRemoteClient() {
    if (this.#wasmRemoteClient) {
      return this.#wasmRemoteClient;
    }
    /** @type {RemoteSettingsClient} */
    const client = lazy.RemoteSettings("translations-wasm");

    // DO NOT LAND! This is working around a bug in Remote Settings dev server.
    client.verifySignature = false;

    client.on("sync", async ({ data: { created, updated, deleted } }) => {
      lazy.console.log(`"sync" event for remote bergamot wasm `, {
        created,
        updated,
        deleted,
      });

      // Remove all the deleted records.
      for (const record of deleted) {
        await client.attachments.deleteDownloaded(record);
      }

      // Remove any updated records, and download the new ones.
      for (const { old: oldRecord } of updated) {
        await client.attachments.deleteDownloaded(oldRecord);
      }

      // Do not thing for the created records.
    });

    this.#wasmRemoteClient = client;
    return client;
  }

  /**
   * Bergamot is the translation engine that has been compiled to wasm. It is shipped
   * to the user via Remote Settings.
   *
   * https://github.com/mozilla/bergamot-translator/
   */
  /**
   * @returns {Promise<ArrayBuffer>}
   */
  async #getBergmotWasmArrayBuffer() {
    const start = Date.now();
    const client = this.#getWasmRemoteClient();

    // Load the wasm binary from remote settings, if it hasn't been already.
    lazy.console.log(`Getting remote bergamot-translator wasm records.`);

    /** @type {import("../components/translations/translations").WasmRecord[]} */
    const wasmRecords = await client.get({
      // Pull the records from the network so that we never get an empty list.
      syncIfEmpty: true,
      // TODO - We should consider the verification process. For now do the slow/safe
      // thing of always verifying the signature.
      verifySignature: true,
      // Only get the bergamot-translator record.
      filter: { name: "bergamot-translator" },
    });

    if (wasmRecords.length === 0) {
      // The remote settings client provides an empty list of records when there is
      // an error.
      throw new Error(
        "Unable to get the bergamot translator from Remote Settings."
      );
    }

    if (wasmRecords.length > 1) {
      lazy.console.error(
        "Expected the bergamot-translator to only have 1 record.",
        wasmRecords
      );
    }

    // Unlike the models, greedily download the wasm. It will pull it from a locale
    // cache on disk if it's already been downloaded. Do not retain a copy, as
    // this will be running in the parent process. It's not worth holding onto
    // this much memory, so re-load it every time it is needed.
    const { buffer } = await client.attachments.download(wasmRecords[0]);

    const duration = Date.now() - start;
    lazy.console.log(
      `"bergamot-translator" wasm binary loaded in ${duration / 1000} seconds`
    );

    return buffer;
  }

  /**
   * Gets the language model files in an array buffer by downloading attachments from
   * Remote Settings, or retrieving them from the locale cache. Each translation
   * requires multiple files, which are enumerated in the ModelTypes.
   *
   * Results are only returned if the model is found.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {boolean} withQualityEstimation
   * @returns {null | Record<ModelTypes, { buffer: ArrayBuffer, record: ModelRecord }>}
   */
  async getLanguageModelBuffers(
    fromLanguage,
    toLanguage,
    withQualityEstimation = false
  ) {
    const client = this.#getModelsRemoteClient();

    lazy.console.log(
      `Beginning model downloads: "${fromLanguage}" to "${toLanguage}"`
    );

    const records = [...(await this.#getModelRecords()).values()];

    /**
     * @type {null | Record<ModelTypes, { buffer: ArrayBuffer, record: ModelRecord }>}
     */
    let results = null;

    // Use Promise.all to download (or retrieve from cache) the model files in parallel.
    await Promise.all(
      records.map(async record => {
        if (record.fileType === "qualityModel" && !withQualityEstimation) {
          // Do not include the quality models if they aren't needed.
          return;
        }

        if (record.fromLang !== fromLanguage || record.toLang !== toLanguage) {
          // Only use models that match.
          return;
        }

        if (!results) {
          results = {};
        }

        const start = Date.now();

        // Download or retrieve from the locale cache:
        const download = await client.attachments.download(record);

        results[record.fileType] = {
          buffer: download.buffer,
          record,
        };

        lazy.console.log(
          `Model fetched in ${(Date.now() - start) / 1000} seconds:`,
          record.fromLang,
          record.toLang,
          record.fileType
        );
      })
    );

    if (!results) {
      // No model files were found, pivoting will be required.
      return null;
    }

    // Validate that all of the files we expected were actually available and
    // downloaded.

    if (!results.model) {
      throw new Error(
        `No model file was found for "${fromLanguage}" to "${toLanguage}."`
      );
    }

    if (!results.lex) {
      throw new Error(
        `No lex file was found for "${fromLanguage}" to "${toLanguage}."`
      );
    }

    if (withQualityEstimation && !results.qualityModel) {
      throw new Error(
        `No quality file was found for "${fromLanguage}" to "${toLanguage}."`
      );
    }

    if (results.vocab) {
      if (results.srcvocab) {
        throw new Error(
          `A srcvocab and vocab file were both included for "${fromLanguage}" to "${toLanguage}." Only one is needed.`
        );
      }
      if (results.trgvocab) {
        throw new Error(
          `A trgvocab and vocab file were both included for "${fromLanguage}" to "${toLanguage}." Only one is needed.`
        );
      }
    } else if (!results.srcvocab || !results.srcvocab) {
      throw new Error(
        `No vocab files were provided for "${fromLanguage}" to "${toLanguage}."`
      );
    }

    return results;
  }
}
