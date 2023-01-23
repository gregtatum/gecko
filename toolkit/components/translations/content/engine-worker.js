/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @typedef {import("../translations").BergamotModule} BergamotModule
 * @typedef {import("../translations").TranslationMessage} TranslationMessage
 * @typedef {import("../translations").LanguageModelBlobs} LanguageModelBlobs
 * @typedef {import("../translations").AlignedMemory} AlignedMemory
 * @typedef {import("../translations").TranslationModel} TranslationModel
 * @typedef {import("../translations").EnginePhase} EnginePhase
 * @typedef {import("../translations").BlockingService} BlockingService
 * @typedef {import("../translations").VectorString} VectorString
 * @typedef {import("../translations").VectorResponse} VectorResponse
 * @typedef {import("../translations").Vector} Vector
 */

/* global loadEmscriptenGlueCode */
importScripts(
  "chrome://global/content/translations/bergamot-translator/worker.js"
);

// Respect the preference "browser.translations.logLevel".
let _isLoggingEnabled = false;
function log(...args) {
  if (_isLoggingEnabled) {
    console.log("Translations [worker]", ...args);
  }
}

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

//
/**
 * The alignment for each file type, file type strings should be same as in the
 * model registry.
 */
const MODEL_FILE_ALIGNMENTS = {
  model: 256,
  lex: 64,
  vocab: 64,
  qualityModel: 64,
  srcvocab: 64,
  trgvocab: 64,
};

// Wait for the initialization request.
addEventListener("message", initialize);

/**
 * Initialize the engine, and get it ready to handle translation requests.
 * The "initialize" message must be received before any other message handling
 * requests will be processed.
 */
async function initialize({ data }) {
  if (data.type !== "initialize") {
    throw new Error(
      "The TranslationEngine worker received a message before it was initialized."
    );
  }

  try {
    const {
      fromLanguage,
      toLanguage,
      bergmotWasmArrayBuffer,
      languageModels,
      isLoggingEnabled,
    } = data;

    if (isLoggingEnabled) {
      // Respect the "browser.translations.logLevel" preference.
      _isLoggingEnabled = true;
    }

    const bergamot = await BergamotUtils.initializeWasm(bergmotWasmArrayBuffer);
    new TranslationsEngineWorker(fromLanguage, toLanguage, bergamot, languageModels);
  } catch (error) {
    // TODO - Handle this error in the UI.
    console.error(error);
    postMessage({ type: "initialization-error", error: error?.message });
  }

  postMessage({ type: "initialization-success" });

  // Only listen to this one message.
  removeEventListener("message", initialize);
}

// TODO - Add docs
class TranslationsEngineWorker {
  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {BergamotModule} bergamot
   * @param {Record<ModelTypes, { buffer: ArrayBuffer, record: ModelRecord }[]} languageModelFiles
   */
  constructor(fromLanguage, toLanguage, bergamot, languageModelFiles) {
    /** @type {string} */
    this.fromLanguage = fromLanguage;
    /** @type {string} */
    this.toLanguage = toLanguage;
    /** @type {BergamotModule} */
    this.bergamot = bergamot;
    /** @type {TranslationModel[]} */
    this.languageModels = languageModelFiles.map(languageModelFiles =>
      BergamotUtils.constructSingleTranslationModel(
        bergamot,
        languageModelFiles
      )
    );

    /** @type {BlockingService} */
    this.translationService = new bergamot.BlockingService({
      // Caching is disabled (see https://github.com/mozilla/firefox-translations/issues/288)
      cacheSize: 0,
    });

    addEventListener("message", this.onMessage.bind(this));
  }

  onMessage({ data }) {
    if (data.type === "initialize") {
      throw new Error("The Translations engine must not be re-initialized.");
    }
    log("Received message", data);

    switch (data.type) {
      case "translation-request": {
        const { messageBatch, generation } = data;
        try {
          const translations = this.translate(messageBatch);
          postMessage({
            type: "translation-response",
            translations,
            generation,
          });
        } catch (error) {
          console.error(error);
          postMessage({
            type: "translation-error",
            generation,
          });
        }
        break;
      }
      default:
        console.warn("Unknown message type:", data.type);
    }
  }

  /**
   * @param {string[]} messageBatch
   * @param {boolean} withQualityEstimation
   */
  translate(messageBatch, withQualityEstimation = false) {
    let response;
    const { messages, options } = BergamotUtils.getTranslationArgs(
      this.bergamot,
      messageBatch,
      withQualityEstimation
    );
    try {
      if (messages.size() === 0) {
        return [];
      }

      /** @type {VectorResponse} */
      let responses;

      if (this.languageModels.length === 1) {
        responses = this.translationService.translate(
          this.languageModels[0],
          messages,
          options
        );
      } else if (this.languageModels.length === 2) {
        responses = this.translationService.translateViaPivoting(
          this.languageModels[0],
          this.languageModels[1],
          messages,
          options
        );
      } else {
        throw new Error(
          "Too many models were provided to the translation worker."
        );
      }

      // Extract JavaScript values out of the vector.
      return BergamotUtils.mapVector(responses, response =>
        response.getTranslatedText()
      );
    } finally {
      // Free up any memory that was allocated. This will always run.
      messages?.delete();
      options?.delete();
      response?.delete();
    }
  }
}

/**
 * Static utilities to help work with the Bergamot wasm module.
 */
class BergamotUtils {
  /**
   * Construct a single translation model.
   *
   * @param {BergamotModule} bergamot
   * @param {Record<ModelTypes, { buffer: ArrayBuffer, record: ModelRecord }} languageModelFiles
   * @return {TranslationModel}
   */
  static constructSingleTranslationModel(bergamot, languageModelFiles) {
    log(`Constructing translation model.`);

    const {
      model,
      lex,
      vocab,
      qualityModel,
      srcvocab,
      trgvocab,
    } = BergamotUtils.allocateModelMemory(bergamot, languageModelFiles);

    // Transform the bytes to mb, like "10.2mb"
    const getMemory = memory => `${Math.floor(memory.size() / 100_000) / 10}mb`;

    let memoryLog = `Model memory sizes in wasm heap:`;
    memoryLog += `\n  Model: ${getMemory(model)}`;
    memoryLog += `\n  Shortlist: ${getMemory(lex)}`;

    // Set up the vocab list, which could either be a single "vocab" model, or a
    // "srcvocab" and "trgvocab" pair.
    const vocabList = new bergamot.AlignedMemoryList();

    if (vocab) {
      vocabList.push_back(vocab);
      memoryLog += `\n  Vocab: ${getMemory(vocab)}`;
    } else if (srcvocab && trgvocab) {
      vocabList.push_back(srcvocab);
      vocabList.push_back(trgvocab);
      memoryLog += `\n  Src Vocab: ${getMemory(srcvocab)}`;
      memoryLog += `\n  Trg Vocab: ${getMemory(trgvocab)}`;
    } else {
      throw new Error("Vocabulary key is not found.");
    }

    if (qualityModel) {
      memoryLog += `\n  QualityModel: ${getMemory(qualityModel)}\n`;
    }

    const config = BergamotUtils.generateTextConfig({
      "beam-size": "1",
      normalize: "1.0",
      "word-penalty": "0",
      "max-length-break": "128",
      "mini-batch-words": "1024",
      workspace: "128",
      "max-length-factor": "2.0",
      "skip-cost": (!qualityModel).toString(),
      "cpu-threads": "0",
      quiet: "true",
      "quiet-translation": "true",
      "gemm-precision": languageModelFiles.model.record.name.endsWith(
        "intgemm8.bin"
      )
        ? "int8shiftAll"
        : "int8shiftAlphaAll",
      alignment: "soft",
    });

    log(`Bergamot translation model config: ${config}`);
    log(memoryLog);

    return new bergamot.TranslationModel(
      config,
      model,
      lex,
      vocabList,
      qualityModel ?? null
    );
  }

  /**
   * The models must be placed in aligned memory that the Bergamot wasm module has access
   * to. This function copies over the model blobs into this memory space.
   *
   * @param {BergamotModule} bergamot
   * @param {Record<ModelTypes, { buffer: ArrayBuffer, record: ModelRecord }} languageModelFiles
   * @returns {Record<ModelTypes, AlignedMemory>}
   */
  static allocateModelMemory(bergamot, languageModelFiles) {
    /** @type {Record<ModelTypes, AlignedMemory} */
    const results = {};

    for (const [fileType, file] of Object.entries(languageModelFiles)) {
      const alignment = MODEL_FILE_ALIGNMENTS[fileType];
      if (!alignment) {
        throw new Error(`Unknown file type: "${fileType}"`);
      }

      const alignedMemory = new bergamot.AlignedMemory(
        file.buffer.byteLength,
        alignment
      );

      // TODO - Does this need to be an Int8Array? Can it be a Uint8Array or even just
      // the raw ArrayBuffer?
      alignedMemory.getByteArrayView().set(new Int8Array(file.buffer));

      results[fileType] = alignedMemory;
    }

    return results;
  }

  /**
   * Initialize the bergamot translation engine. It is a wasm compiled version of the
   * Marian translation software. The wasm is delivered remotely to cut down on binary size.
   *
   * https://github.com/mozilla/bergamot-translator/
   *
   * @param {ArrayBuffer} wasmBinary
   * @returns {Promise<BergamotModule>}
   */
  static initializeWasm(wasmBinary) {
    return new Promise((resolve, reject) => {
      /** @type {number} */
      let start = performance.now();

      const bergamot = loadEmscriptenGlueCode({
        preRun: [],
        onAbort() {
          reject(new Error("Error loading Bergamot wasm module."));
        },
        onRuntimeInitialized: async () => {
          const duration = performance.now() - start;
          log(`Bergamot wasm runtime initialized in ${duration / 1000} secs`);
          // await at least one microtask so that the captured `bergamot` variable is
          // fully isnitializzed.
          await Promise.resolve();
          resolve(bergamot);
        },
        wasmBinary,
      });
    });
  }

  /**
   * Maps the Bergamot Vector to a JS array
   *
   * @param {Vector} vector
   * @param {Function} fn
   */
  static mapVector(vector, fn) {
    const result = [];
    for (let index = 0; index < vector.size(); index++) {
      result.push(fn(vector.get(index), index));
    }
    return result;
  }

  /**
   * Generate a config for the Marian translation service. It requires specific whitespace.
   *
   * https://marian-nmt.github.io/docs/cmd/marian-decoder/
   *
   * @param {Record<string, string>} config
   * @returns {string}
   */
  static generateTextConfig(config) {
    const indent = "            ";
    let result = "\n";

    for (const [key, value] of Object.entries(config)) {
      result += `${indent}${key}: ${value}\n`;
    }

    return result + indent;
  }

  /**
   * JS objects need to be translated into wasm objects to configure the translation engine.
   * @param {BergamotModule} bergamot
   * @param {string[]} messageBatch
   * @param {boolean} withQualityEstimation
   */
  static getTranslationArgs(bergamot, messageBatch, withQualityEstimation) {
    const messages = new bergamot.VectorString();
    const options = new bergamot.VectorResponseOptions();
    for (const message of messageBatch) {
      // Empty paragraphs break the translation.
      if (message.trim() === "") {
        continue;
      }

      // TODO - Consider porting the original HTML message escaping behavior.
      // https://github.com/mozilla/firefox-translations/blob/431e0d21f22694c1cbc0ff965820d9780cdaeea8/extension/controller/translation/translationWorker.js#L146-L158

      messages.push_back(message);
      options.push_back({
        qualityScores: withQualityEstimation,
        alignment: true,
        html: message.isHTML,
      });
    }
    return { messages, options };
  }
}
