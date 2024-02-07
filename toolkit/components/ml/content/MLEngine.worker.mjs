/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { PromiseWorker } from "resource://gre/modules/workers/PromiseWorker.mjs";
import {
  sentenceIterator,
  extractEntities,
  cleanText,
  cleanOutput,
  mergeEntities,
} from "chrome://global/content/ml/utils.mjs";

import {
  env,
  AutoTokenizer,
  AutoModelForTokenClassification,
  AutoModelForSequenceClassification,
  T5Tokenizer,
  T5ForConditionalGeneration,
} from "chrome://global/content/ml/transformers.min.js";

const DEFAULT_SUMMARIZER_MODEL = "tarekziade/text_summarization";
const DEFAULT_NER_MODEL = "Xenova/bert-base-NER";

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.ml.logLevel",
    prefix: "ML",
  });
});
/**
 * The actual MLEngine lives here in a worker.
 */
class MLEngineWorker {
  #model;
  #tokenizer;
  #task;
  #initTime;

  constructor() {
    // Connect the provider to the worker.
    this.#connectToPromiseWorker();
  }

  async initializeEngine(options) {
    env.useBrowserCache = false;

    if (options.testing) {
      // when running in tests we don't hit the network
      env.allowRemoteModels = false;
      env.localModelPath = "chrome://global/content/ml/models";
      env.backends.onnx.wasm.wasmPaths = "chrome://global/content/ml/ort/";
    } else {
      // when running live, we don't use the disk.
      env.allowLocalModels = false;
    }

    // initializing the inference engine
    this.#task = options.task;
    lazy.console.debug("Initializing ML engine for task:", this.#task);
    let modelName;

    const start = Date.now();
    switch (this.#task) {
      case "text-classification":
        this.#model = await AutoModelForSequenceClassification.from_pretrained(
          "Xenova/ms-marco-TinyBERT-L-2-v2"
        );
        this.#tokenizer = await AutoTokenizer.from_pretrained(
          "Xenova/ms-marco-TinyBERT-L-2-v2"
        );
        break;

      case "summarization":
        modelName = options.modelName ?? DEFAULT_SUMMARIZER_MODEL;

        this.#model = await T5ForConditionalGeneration.from_pretrained(
          modelName
        );
        this.#tokenizer = await T5Tokenizer.from_pretrained(modelName);
        break;

      case "token-classification":
        modelName = options.modelName ?? DEFAULT_NER_MODEL;
        this.#model = await AutoModelForTokenClassification.from_pretrained(
          modelName
        );
        this.#tokenizer = await AutoTokenizer.from_pretrained(modelName);
        break;

      default:
        throw new Error(`Unknown task: ${this.#task}`);
    }
    this.#initTime = Date.now() - start;

    lazy.console.log("MLEngineWorker is initialized, took ", this.#initTime);
  }

  /**
   * Run the worker.
   *
   * @param {string} request
   */
  async run(request) {
    if (request === "throw") {
      throw new Error(
        'Received the message "throw", so intentionally throwing an error.'
      );
    }

    const jsonRequest = JSON.parse(request);

    let result;
    let inferenceTime;
    let start;

    switch (this.#task) {
      case "text-classification":
        start = Date.now();

        const features = this.#tokenizer(
          jsonRequest.queries.map(query => cleanText(query)),
          {
            text_pair: jsonRequest.text_pair.map(text => cleanText(text)),
            truncation: true,
            padding: true,
          }
        );

        result = { metrics: { tokenizingTime: Date.now() - start } };

        start = Date.now();
        const res = await this.#model(features);
        inferenceTime = Date.now() - start;

        const scores = Object.values(res.logits.data);
        result.output = scores;
        result.metrics.inferenceTime = inferenceTime;
        break;

      case "summarization":
        result = await this.#infere(
          cleanText(jsonRequest.input),
          "summarize: ",
          {
            max_length: 512,
            truncation: true,
          }
        );

        start = Date.now();
        let summary = this.#tokenizer.decode(result.outputs[0], {
          skip_special_tokens: true,
        });
        result.tokenizingTime += Date.now() - start;
        result.output = cleanOutput(summary);

        delete result.outputs;
        delete result.input_ids;
        break;

      case "token-classification":
        const text = cleanText(jsonRequest.input);

        result = {
          entities: {
            Location: [],
            Person: [],
            Miscellaneous: [],
            Organization: [],
          },

          metrics: {
            inferenceTime: 0,
            tokenizingTime: 0,
            initTime: this.#initTime,
          },
        };

        let round = 0;
        const iterator = sentenceIterator(text);

        for (
          let s_result = iterator.next();
          !s_result.done;
          s_result = iterator.next()
        ) {
          const sentence = s_result.value;

          // limit how many sentences we infere for now.
          if (round > 15) {
            break;
          }
          const sentenceResult = await this.#infere(sentence, "", {
            max_length: 512,
            truncation: true,
          });

          result.metrics.inferenceTime += sentenceResult.metrics.inferenceTime;
          result.metrics.tokenizingTime +=
            sentenceResult.metrics.tokenizingTime;

          let sentenceEntities = extractEntities(
            this.#model,
            this.#tokenizer,
            sentenceResult.outputs.logits,
            sentenceResult.input_ids
          );

          result.entities = mergeEntities(result.entities, sentenceEntities);
          round++;
        }

        let entitiesAsSummary = "";
        Object.keys(result.entities).forEach(key => {
          if (result.entities[key].length) {
            entitiesAsSummary += `- ${key}\n`;
            result.entities[key].forEach(entity => {
              entitiesAsSummary += `    - ${entity}\n`;
            });
            entitiesAsSummary += "\n";
          }
        });

        result.output = entitiesAsSummary;
        delete result.outputs;
        delete result.input_ids;
        break;

      default:
        throw new Error(`Unknown task: ${this.#task}`);
    }

    result.metrics.initTime = this.#initTime;
    return JSON.stringify(result);
  }

  async #infere(input, prefix = "", tokenizerOptions = {}) {
    const text = cleanText(input);
    let start = Date.now();
    const tokenized_input = await this.#tokenizer(
      prefix + text,
      tokenizerOptions
    );
    let tokenizingTime = Date.now() - start;

    start = Date.now();
    let outputs;
    switch (this.#task) {
      case "summarization":
        outputs = await this.#model.generate(
          tokenized_input.input_ids,

          { max_length: 100, truncation: true }
        );
        break;

      default:
        outputs = await this.#model(tokenized_input);
    }

    let inferenceTime = Date.now() - start;
    return {
      input_ids: tokenized_input.input_ids,
      outputs,
      metrics: {
        tokenizingTime,
        inferenceTime,
      },
    };
  }

  /**
   * Glue code to connect the `MLEngineWorker` to the PromiseWorker interface.
   */
  #connectToPromiseWorker() {
    const worker = new PromiseWorker.AbstractWorker();
    worker.dispatch = (method, args = []) => {
      if (!this[method]) {
        throw new Error("Method does not exist: " + method);
      }
      return this[method](...args);
    };
    worker.close = () => self.close();
    worker.postMessage = (message, ...transfers) => {
      self.postMessage(message, ...transfers);
    };

    self.addEventListener("message", msg => worker.handleMessage(msg));
    self.addEventListener("unhandledrejection", function (error) {
      throw error.reason;
    });
  }
}

new MLEngineWorker();
