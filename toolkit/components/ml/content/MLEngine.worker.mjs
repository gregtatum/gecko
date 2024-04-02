/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { PromiseWorker } from "resource://gre/modules/workers/PromiseWorker.mjs";
import { Pipeline } from "chrome://global/content/ml/ONNXPipeline.mjs";

/**
 * The actual MLEngine lives here in a worker.
 */
class MLEngineWorker {
  #pipeline;

  constructor() {
    // Connect the provider to the worker.
    this.#connectToPromiseWorker();
  }

  async match(key) {
    let res = await this.getModelFile(key);
    let headers = res.ok[1];
    let modelFile = res.ok[2];

    // Transformers.js expects a response object, so we wrap the array buffer
    const response = new Response(modelFile, {
      status: 200,
      headers,
    });

    return response;
  }

  put() {
    throw new Error("Expected the model to be fetched via RemoteSettings.");
  }

  async getModelFile(...args) {
    let result = await self.callMainThread("getModelFile", args);
    return result;
  }

  /**
   * @param {ArrayBuffer} wasm
   * @param {ArrayBuffer} model
   * @param {string} _loggingLevel
   */
  async initializeEngine(wasm, model, _loggingLevel) {
    let options = JSON.parse(new TextDecoder().decode(model));
    options.runtime = wasm;
    this.#pipeline = await Pipeline.initialize(this, options);
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
    let result = await this.#pipeline.run(request);
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

    self.callMainThread = worker.callMainThread.bind(worker);
    self.addEventListener("message", msg => worker.handleMessage(msg));
    self.addEventListener("unhandledrejection", function (error) {
      throw error.reason;
    });
  }
}

new MLEngineWorker();
