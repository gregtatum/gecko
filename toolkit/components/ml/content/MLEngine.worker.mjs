/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { PromiseWorker } from "resource://gre/modules/workers/PromiseWorker.mjs";

import {
  env,
  AutoTokenizer,
  AutoModelForSequenceClassification,
  T5Tokenizer,
  T5ForConditionalGeneration,
} from "chrome://global/content/ml/transformers.min.js";

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
        this.#model = await T5ForConditionalGeneration.from_pretrained(
          "tarekziade/wikipedia-summaries-t5-efficient-tiny"
        );
        this.#tokenizer = await T5Tokenizer.from_pretrained(
          "tarekziade/wikipedia-summaries-t5-efficient-tiny"
        );
        break;

      default:
        throw new Error(`Unknown task: ${this.#task}`);
    }
    this.#initTime = Date.now() - start;

    lazy.console.log("MLEngineWorker is initialized");
  }

  cleanOutput(text, maxLength = 2) {
    let sentences = text.match(/[^\.!\?]+[\.!\?]+/g);
    sentences = sentences.slice(0, maxLength);
    const capitalizedSentences = sentences.map(sentence => {
      return sentence.charAt(0).toUpperCase() + sentence.slice(1);
    });
    return capitalizedSentences.join(" ");
  }

  cleanText(text) {
    text = text.replace(/\s\s+/g, " ");
    text = text.replace(/[^\w\s.,\/#!\?$%\^&\*;:{}=\-_`~()]/g, "");
    lazy.console.debug(text);
    return text.trim();
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
    lazy.console.debug("inference run requested with:", jsonRequest);

    let result = {};
    let tokenizingTime = 0;
    let inferenceTime;
    let start;

    switch (this.#task) {
      case "text-classification":
        start = Date.now();

        const features = this.#tokenizer(
          jsonRequest.queries.map(query => this.cleanText(query)),
          {
            text_pair: jsonRequest.text_pair.map(text => this.cleanText(text)),
            padding: true,
            truncation: true,
          }
        );

        tokenizingTime = Date.now() - start;

        start = Date.now();
        const res = await this.#model(features);
        inferenceTime = Date.now() - start;

        const scores = Object.values(res.logits.data);
        lazy.console.debug(scores);

        result.scores = scores;
        break;

      case "summarization":
        start = Date.now();
        let { input_ids } = await this.#tokenizer(
          "summarize: " + this.cleanText(jsonRequest.input),
          {
            max_length: 512,
            truncation: true,
          }
        );
        tokenizingTime = Date.now() - start;

        start = Date.now();
        let outputs = await this.#model.generate(input_ids, {
          max_length: 100,
          truncation: true,
        });
        inferenceTime = Date.now() - start;

        start = Date.now();
        let summary = this.#tokenizer.decode(outputs[0], {
          skip_special_tokens: true,
        });
        tokenizingTime += Date.now() - start;
        result.summary = this.cleanOutput(summary, 2);
        break;

      default:
        throw new Error(`Unknown task: ${this.#task}`);
    }

    result.metrics = {
      initTime: this.#initTime,
      tokenizingTime,
      inferenceTime,
    };

    return JSON.stringify(result);
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
