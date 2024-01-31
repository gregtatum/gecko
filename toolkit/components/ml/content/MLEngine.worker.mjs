/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { PromiseWorker } from "resource://gre/modules/workers/PromiseWorker.mjs";

import {
  env,
  AutoTokenizer,
  AutoModelForSequenceClassification,
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

  constructor() {
    // Connect the provider to the worker.
    this.#connectToPromiseWorker();
  }

  /**
   * @param {ArrayBuffer} wasm
   * @param {ArrayBuffer} model
   */
  async initializeEngine(options) {
    env.useBrowserCache = false;

    if (options.testing) {
      // when running in tests we don't hit the network
      env.allowRemoteModels = false;
      env.localModelPath = "chrome://global/content/ml/models";
      env.backends.onnx.wasm.wasmPaths = "chrome://global/content/ml/ort/";
    }
    // initializing the inference engine
    this.#model = await AutoModelForSequenceClassification.from_pretrained(
      "Xenova/ms-marco-TinyBERT-L-2-v2"
    );
    this.#tokenizer = await AutoTokenizer.from_pretrained(
      "Xenova/ms-marco-TinyBERT-L-2-v2"
    );

    lazy.console.log("MLEngineWorker is initialized");
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

    const features = this.#tokenizer(jsonRequest.queries, {
      text_pair: jsonRequest.text_pair,
      padding: true,
      truncation: true,
    });

    const res = await this.#model(features);
    const scores = Object.values(res.logits.data);
    lazy.console.debug(scores);

    return JSON.stringify({ scores: scores });
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
    self.addEventListener("unhandledrejection", function(error) {
      throw error.reason;
    });
  }
}

new MLEngineWorker();
