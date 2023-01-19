/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global loadEmscriptenGlueCode, serializeError, importScripts */

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

importScripts(
  "chrome://global/content/translations/bergamot-translator/worker.js"
);

const console = self.console.createInstance({
  maxLogLevelPref: "browser.translations.logLevel",
  prefix: "Translations",
});

const sendException = ex => {
  console.error(ex);
  postMessage(["reportException", ex?.message]);
};

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

/*
 * this class should only be instantiated the web worker
 * to serve as a helper and placeholoder for the translation related
 * objects like the underlying wasm module, the language models etc... and
 * their states of operation
 */
class TranslationHelper {
  /** @type {Array<TranslationMessage>} */
  translationQueue = [];

  /** @type {BergamotModule | null} */
  BergamotModule = null;

  /** @type {BlockingService | null} */
  translationService = null;

  /** @type {number} */
  totalPendingElements = 0;

  /**
   * A map of language-pair to Bergamot TranslationModel object.
   *
   * @type {Map<string, TranslationModel>}
   */
  translationModels = new Map();

  /**
   * The engine starts out as "engine-not-loaded" mode when the worker is constructed.
   * It is changed to "loading" when the first request is made, then to "loaded" when
   * the language model is loaded.
   *
   * @type {"engine-not-loaded" | "loading" | "loaded"}
   */
  enginePhase = "engine-not-loaded";

  /**
   * @param {ArrayBuffer} wasmArrayBuffer
   */
  async setupBergamotTranslator(wasmArrayBuffer) {
    // TODO - Sort out this loading.
    this.wasmArrayBuffer = wasmArrayBuffer;
  }

  async loadTranslationEngine(
    sourceLanguage,
    targetLanguage,
    withQualityEstimation
  ) {
    postMessage(["updateProgress", "loadingTranslationEngine"]);

    if (!this.wasmArrayBuffer) {
      throw new Error("No wasm binary loaded for the translation engine.");
    }

    /** @type {number} */
    let wasmModuleStartTimestamp;

    const initialModule = {
      preRun: [
        () => {
          wasmModuleStartTimestamp = performance.now();
        },
      ],
      onAbort() {
        sendException(new Error("Error loading engine (onAbort)"));
        console.log("Error loading wasm module.");
        postMessage(["reportError", "engine_load"]);
        postMessage(["updateProgress", "errorLoadingWasm"]);
      },
      onRuntimeInitialized: () => {
        /*
         * once we have the wasm engine module successfully
         * initialized, we then load the language models
         */
        const seconds = (performance.now() - wasmModuleStartTimestamp) / 1000;
        console.log(
          `Wasm Runtime initialized Successfully (preRun -> onRuntimeInitialized) in ${seconds} secs`
        );
        this.getLanguageModels(
          sourceLanguage,
          targetLanguage,
          withQualityEstimation
        );
      },
      wasmBinary: this.wasmArrayBuffer,
    };
    try {
      this.BergamotModule = loadEmscriptenGlueCode(initialModule);
    } catch (e) {
      console.log("Error loading wasm module:", e);
      sendException(e);
      postMessage(["reportError", "engine_load"]);
      postMessage(["updateProgress", "errorLoadingWasm"]);
    }
  }

  translateOutboundTranslation(message) {
    Promise.resolve().then(
      function() {
        let total_words = message[0].sourceParagraph
          .replace(/(<([^>]+)>)/gi, "")
          .trim()
          .split(/\s+/).length;
        const t0 = performance.now();

        /*
         * quality scores are not required for outbound translation. So we set the
         * corresponding flag to false before calling translate api and restore
         * its value after the api call is complete.
         */
        let originalQualityEstimation = message[0].withQualityEstimation;
        message[0].withQualityEstimation = false;
        const translationResultBatch = this.translate(message);
        message[0].withQualityEstimation = originalQualityEstimation;
        const timeElapsed = [total_words, performance.now() - t0];

        message[0].translatedParagraph = translationResultBatch[0];
        // and then report to the mediator
        postMessage(["translationComplete", message, timeElapsed]);
      }.bind(this)
    );
  }

  consumeTranslationQueue() {
    while (this.translationQueue.length) {
      const translationMessagesBatch = this.translationQueue.shift();
      this.totalPendingElements += translationMessagesBatch.length;
      postMessage([
        "updateProgress",
        ["translationProgress", [`${this.totalPendingElements}`]],
      ]);
      Promise.resolve().then(
        function() {
          if (translationMessagesBatch && translationMessagesBatch.length) {
            try {
              let total_words = 0;
              translationMessagesBatch.forEach(message => {
                let words = message.sourceParagraph
                  .replace(/(<([^>]+)>)/gi, "")
                  .trim()
                  .split(/\s+/);
                total_words += words.length;
              });

              /*
               * engine doesn't return QE scores for the translation of Non-HTML source
               * messages. Therefore, always encode and pass source messages as HTML to the
               * engine and restore them afterwards to their original form.
               */
              const escapeHtml = text => {
                return String(text)
                  .replace(/&/g, "&amp;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&#039;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;");
              };

              const non_html_qe_messages = new Map();
              translationMessagesBatch.forEach((message, index) => {
                if (message.withQualityEstimation && !message.isHTML) {
                  console.log(
                    `Plain text received to translate with QE: "${message.sourceParagraph}"`
                  );
                  non_html_qe_messages.set(index, message.sourceParagraph);
                  message.sourceParagraph = escapeHtml(message.sourceParagraph);
                  message.isHTML = true;
                }
              });

              const t0 = performance.now();
              const translationResultBatch = this.translate(
                translationMessagesBatch
              );
              const timeElapsed = [total_words, performance.now() - t0];

              /*
               * restore Non-HTML source messages that were encoded to HTML before being sent to
               * engine to get the QE scores for their translations. The translations are not
               * required to be decoded back to non-HTML form because QE scores are embedded in
               * the translation via html attribute.
               */
              non_html_qe_messages.forEach((value, key) => {
                console.log("Restoring back source text and html flag");
                translationMessagesBatch[key].sourceParagraph = value;
                translationMessagesBatch[key].isHTML = false;
              });

              /*
               * now that we have the paragraphs back, let's reconstruct them.
               * we trust the engine will return the paragraphs always in the same order
               * we requested
               */
              translationResultBatch.forEach((result, index) => {
                translationMessagesBatch[index].translatedParagraph = result;
              });
              // and then report to the mediator
              postMessage([
                "translationComplete",
                translationMessagesBatch,
                timeElapsed,
              ]);
              this.totalPendingElements -= translationMessagesBatch.length;
              postMessage([
                "updateProgress",
                ["translationProgress", [`${this.totalPendingElements}`]],
              ]);
            } catch (e) {
              sendException(e);
              postMessage(["reportError", "translation"]);
              postMessage(["updateProgress", "translationLoadedWithErrors"]);
              console.error("Translation error: ", e);
              throw e;
            }
          }
        }.bind(this)
      );
    }
  }

  requestTranslation(message) {
    switch (this.enginePhase) {
      case "engine-not-loaded":
        this.enginePhase = "loading";
        this.loadTranslationEngine(
          message[0].sourceLanguage,
          message[0].targetLanguage,
          message[0].withQualityEstimation ?? false
        );

        this.translationQueue.push(message);
        break;
      case "loading":
        /*
         * if we get a translation request while the engine is
         * being loaded, we enqueue the message and break
         */
        this.translationQueue.push(message);
        break;

      case "loaded":
        if (message[0] && message[0].type === "outbound") {
          /*
           * we skip the line if the message is from ot.
           * and since we know this is OT, there's only one msg
           */
          this.translateOutboundTranslation([message[0]]);
        } else {
          this.translationQueue.push(message);
          this.consumeTranslationQueue();
        }
        break;
      default:
        console.warn("Unknown engine state", this.enginePhase);
    }
  }

  getLanguageModels(sourceLanguage, targetLanguage, withQualityEstimation) {
    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;
    this.withQualityEstimation = withQualityEstimation;

    /**
     * @type {Array<{ name: string, withQualityEstimation: boolean }}
     */
    let languagePairs = [];

    if (isPivotingRequired(sourceLanguage, targetLanguage)) {
      // Pivoting requires 2 translation models.
      languagePairs.push(
        {
          name: getLanguagePair(sourceLanguage, PIVOT_LANGUAGE),
          withQualityEstimation,
        },
        {
          name: getLanguagePair(PIVOT_LANGUAGE, targetLanguage),
          withQualityEstimation,
        }
      );
    } else {
      languagePairs.push({
        name: getLanguagePair(sourceLanguage, targetLanguage),
        withQualityEstimation,
      });
    }
    postMessage(["downloadLanguageModels", languagePairs]);
  }

  /**
   * @param {LanguageModelBlobs[]} languageModelBlobs
   */
  async loadLanguageModel(languageModelBlobs) {
    /*
     * let's load the models and communicate to the caller (translation)
     * when we are finished
     */
    let start = performance.now();
    try {
      this.constructTranslationService();
      await this.constructTranslationModels(
        languageModelBlobs,
        this.sourceLanguage,
        this.targetLanguage,
        this.withQualityEstimation
      );

      const duration = performance.now() - start;
      console.log(
        `Model '${this.sourceLanguage} -> ${this.targetLanguage}' successfully ` +
          `constructed in ${duration / 1000} secs`
      );
      postMessage([
        "reportPerformanceTimespan",
        "model_load_time_num",
        duration,
      ]);
    } catch (error) {
      console.error(
        `Model '${this.sourceLanguage} -> ${this.targetLanguage}' construction failed.`,
        error
      );
      sendException(error);
      postMessage(["reportError", "model_load"]);
      postMessage(["updateProgress", "errorLoadingWasm"]);
      return;
    }

    this.enginePhase = "loaded";

    postMessage(["updateProgress", "translationEnabled"]);

    this.consumeTranslationQueue();

    console.log("loadLanguageModel function complete");
  }

  /**
   * Initializes the Bergamot translation service that provides the translations.
   */
  constructTranslationService() {
    if (!this.translationService) {
      const config = {
        // Caching is disabled (see https://github.com/mozilla/firefox-translations/issues/288)
        cacheSize: 0,
      };
      this.translationService = new this.BergamotModule.BlockingService(config);
      console.log("Translation Service created with config", config);
    }
  }

  /**
   * Construct any language models that are needed for the translation. Sometimes
   * two models are needed for pivot translations, when there is not a model available
   * to directly translate between two languages.
   *
   * @prop {LanguageModelBlobs} languageModels
   * @prop {string} from
   * @prop {string} to
   * @prop {boolean} withQualityEstimation
   */
  async constructTranslationModels(
    languageModelBlobs,
    from,
    to,
    withQualityEstimation
  ) {
    if (isPivotingRequired(from, to)) {
      // Pivoting requires 2 translation models to be constructed
      await Promise.all([
        this.constructSingleTranslationModel(
          languageModelBlobs,
          getLanguagePair(from, PIVOT_LANGUAGE),
          withQualityEstimation
        ),
        this.constructSingleTranslationModel(
          languageModelBlobs,
          getLanguagePair(PIVOT_LANGUAGE, to),
          withQualityEstimation
        ),
      ]);
    } else {
      // non-pivoting case requires only 1 translation model
      await this.constructSingleTranslationModel(
        languageModelBlobs,
        getLanguagePair(from, to),
        withQualityEstimation
      );
    }
  }

  /**
   * Construct a single translation model.
   *
   * @param {LanguageModelBlobs[]} languageModels
   * @param {string} languagePair
   * @param {boolean} withQualityEstimation
   */
  async constructSingleTranslationModel(
    languageModels,
    languagePair,
    withQualityEstimation
  ) {
    console.log(`Constructing translation model ${languagePair}`);

    const languageModel = languageModels.find(
      ({ name }) => name === languagePair
    );

    if (!languageModel) {
      throw new Error("Could not find language model: " + languagePair);
    }

    const {
      model,
      lex,
      vocab,
      qualityModel,
      srcvocab,
      trgvocab,
    } = allocateModelMemory(
      this.BergamotModule,
      languageModels,
      withQualityEstimation
    );

    let memoryLog =
      `Aligned memory sizes: ` +
      `Model:${model.size()}, ` +
      `Shortlist:${lex.size()}, `;

    // Set up the vocab list, which could either be a single "vocab" model, or a
    // "srcvocab" and "trgvocab" pair.
    const vocabList = new this.BergamotModule.AlignedMemoryList();

    if (vocab) {
      vocabList.push_back(vocab);
      memoryLog += ` Vocab: ${vocab.size()}`;
    } else if (srcvocab && trgvocab) {
      vocabList.push_back(alignedMemories.srcvocab);
      vocabList.push_back(alignedMemories.trgvocab);
      memoryLog += ` Src Vocab: ${alignedMemories.srcvocab.size()}`;
      memoryLog += ` Trg Vocab: ${alignedMemories.trgvocab.size()}`;
    } else {
      throw new Error("vocabulary key is not found");
    }

    if (qualityModel) {
      memoryLog += ` QualityModel: ${qualityModel.size()}`;
    }

    console.log(memoryLog);

    const modelName = "";
    if (!modelName) {
      throw new Error("Expected the main model' name here");
    }

    const config = {
      "beam-size": "1",
      normalize: "1.0",
      "word-penalty": "0",
      "max-length-break": "128",
      "mini-batch-words": "1024",
      workspace: "128",
      "max-length-factor": "2.0",
      "skip-cost": (!withQualityEstimation).toString(),
      "cpu-threads": "0",
      quiet: "true",
      "quiet-translation": "true",
      "gemm-precision": modelName.endsWith("intgemm8.bin")
        ? "int8shiftAll"
        : "int8shiftAlphaAll",
      alignment: "soft",
    };

    console.log(`Translation model config: ${config}`);

    const translationModel = new this.BergamotModule.TranslationModel(
      generateMarianConfig(config),
      model,
      lex,
      vocabList,
      qualityModel ?? null
    );

    this.translationModels.set(languagePair, translationModel);
    return translationModel;
  }

  /**
   * @param {TranslationMessage[]} messages
   */
  translate(messages) {
    const from = messages[0].sourceLanguage;
    const to = messages[0].targetLanguage;

    /*
     * vectorResponseOptions, vectorSourceText are the arguments of translate API
     * and vectorResponse is the result where each of its item corresponds to an item
     * of vectorSourceText in the same order.
     */

    /** @type {VectorResponse | undefined} */
    let vectorResponse;

    /** @type {VectorResponseOptions | undefined} */
    let vectorResponseOptions;

    /** @type {VectorString | undefined} */
    let vectorSourceText;

    try {
      vectorResponseOptions = this.prepareResponseOptions(messages);
      vectorSourceText = this.prepareSourceText(messages);

      if (isPivotingRequired(from, to)) {
        // translate via pivoting
        const translationModelSrcToPivot = this.getLoadedTranslationModel(
          from,
          PIVOT_LANGUAGE
        );
        const translationModelPivotToTarget = this.getLoadedTranslationModel(
          PIVOT_LANGUAGE,
          to
        );
        vectorResponse = this.translationService.translateViaPivoting(
          translationModelSrcToPivot,
          translationModelPivotToTarget,
          vectorSourceText,
          vectorResponseOptions
        );
      } else {
        // translate without pivoting
        const translationModel = this.getLoadedTranslationModel(from, to);
        vectorResponse = this.translationService.translate(
          translationModel,
          vectorSourceText,
          vectorResponseOptions
        );
      }

      return mapVector(vectorResponse, response =>
        response.getTranslatedText()
      );
    } catch (error) {
      console.error("Error in translation engine ", error);
      sendException(error);
      postMessage(["reportError", "marian"]);
      postMessage(["updateProgress", "translationLoadedWithErrors"]);
    } finally {
      // Clean up any of the data that is no longer needed.
      vectorSourceText?.delete();
      vectorResponseOptions?.delete();
      vectorResponse?.delete();
    }
  }

  /**
   * Returns the already constructed model given the language pair.
   * @returns {TranslationModel}
   */
  getLoadedTranslationModel(from, to) {
    const languagePair = getLanguagePair(from, to);
    const translationModel = this.translationModels.get(languagePair);
    if (!translationModel) {
      throw Error(`Translation model '${languagePair}' not loaded`);
    }
    return translationModel;
  }

  /**
   * @param {TranslationMessage[]} messages
   * @returns {VectorResponseOptions}
   */
  prepareResponseOptions(messages) {
    const vectorResponseOptions = new this.BergamotModule.VectorResponseOptions();

    for (const message of messages) {
      vectorResponseOptions.push_back({
        qualityScores: message.withQualityEstimation,
        alignment: true,
        html: message.isHTML,
      });
    }

    if (vectorResponseOptions.size() === 0) {
      vectorResponseOptions.delete();
      throw Error("No Translation Options provided");
    }
    return vectorResponseOptions;
  }

  /**
   * @param {TranslationMessage[]} messages
   * @returns {VectorString}
   */
  prepareSourceText(messages) {
    const vectorSourceText = new this.BergamotModule.VectorString();

    for (const { sourceParagraph } of messages) {
      // Empty paragraphs break the translation.
      if (sourceParagraph.trim() === "") {
        continue;
      }
      vectorSourceText.push_back(sourceParagraph);
    }

    if (vectorSourceText.size() === 0) {
      vectorSourceText.delete();
      throw Error("No text provided to translate");
    }

    return vectorSourceText;
  }
}

/**
 * Transforms a langauge pair, like "en" -> "es" to "enes".
 *
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
function isPivotingRequired(from, to) {
  return from !== PIVOT_LANGUAGE && to !== PIVOT_LANGUAGE;
}

/**
 * Transforms a langauge pair, like "en" -> "es" to "enes".
 *
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
function getLanguagePair(from, to) {
  return `${from}${to}`;
}

/**
 * Maps the Bergamot Vector to a JS array
 * @param {Vector} vector
 * @param {Function} fn
 */
function mapVector(vector, fn) {
  const result = [];
  for (let index = 0; index < vector.size(); index++) {
    result.push(fn(vector.get(index), index));
  }
  return result;
}

/**
 * This function returns a substring of text. The substring is represented by
 * byteRange (begin and end indices) within the utf-8 encoded version of the text.
 *
 * @param {string} text
 * @param {{ begin: number, end: number }} byteRange
 */
function getSentenceFromByteRange(text, byteRange) {
  const encoder = new TextEncoder(); // string to utf-8 converter
  const decoder = new TextDecoder(); // utf-8 to string converter
  const utf8BytesView = encoder.encode(text);
  const utf8SentenceBytes = utf8BytesView.subarray(
    byteRange.begin,
    byteRange.end
  );
  return decoder.decode(utf8SentenceBytes);
}

/**
 * Generate a config for the Marian translation service. It requires specific whitespace.
 *
 * https://marian-nmt.github.io/docs/cmd/marian-decoder/
 *
 * @param {Record<string, string>} config
 * @returns {string}
 */
function generateMarianConfig(config) {
  const indent = "            ";
  let result = "\n";

  for (const [key, value] of Object.entries(config)) {
    result += `${indent}${key}: ${value}\n`;
  }

  return result + indent;
}

/**
 * The models must be placed in aligned memory that the Bergamot wasm module has access
 * to. This function copies over the model blobs into this memory space.
 *
 * @param {BergamotModule} BergamotModule,
 * @param {LanguageModelBlobs} languageModel
 * @returns {Record<ModelTypes, AlignedMemory>}
 */
async function allocateModelMemory(
  BergamotModule,
  languageModel,
  withQualityEstimation
) {
  /** @type {Record<ModelTypes, AlignedMemory} */
  const results = {};

  for (const [fileType, alignment] of Object.entries(MODEL_FILE_ALIGNMENTS)) {
    if (fileType === "qualityModel" && !withQualityEstimation) {
      continue;
    }

    /** @type {Blob} */
    const blob = languageModel.languageModelBlobs[fileType];
    if (!blob) {
      continue;
    }

    const alignedMemory = new BergamotModule.AlignedMemory(
      byteArray.byteLength,
      alignment
    );

    alignedMemory
      .getByteArrayView()
      .set(new Int8Array(await blob.arrayBuffer()));

    results[fileType] = alignedMemory;
  }

  return results;
}

const translationHelper = new TranslationHelper();

onmessage = function(message) {
  const [name, ...args] = message.data;
  console.log(`received message`, name, args);
  switch (name) {
    case "translate":
      try {
        translationHelper.requestTranslation(args[0]);
      } catch (ex) {
        sendException(ex);
        throw ex;
      }
      break;
    case "responseDownloadLanguageModels":
      translationHelper.loadLanguageModel(args[0]);
      break;
    case "setupBergamotTranslator":
      translationHelper.setupBergamotTranslator(args[0]);
      break;
    default:
    // ignore
  }
};
