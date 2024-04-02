/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
var { env, RawImage, AutoProcessor, AutoTokenizer, AutoModelForVision2Seq } =
  ChromeUtils.importESModule("chrome://global/content/ml/transformers.js", {
    global: "current",
  });

/**
 * Lazy initialization container.
 *
 * @type {object}
 */
const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.ml.logLevel",
    prefix: "ML",
  });
});

/**
 * Converts an image to text using a machine learning model.
 *
 * @async
 * @param {object} request - The request object containing image data.
 * @param {object} model - The model used for inference.
 * @param {object} tokenizer - The tokenizer used for decoding.
 * @param {object} processor - The processor used for preparing image data.
 * @returns {Promise<object>} The result object containing the processed text.
 */
async function image_to_text(request, model, tokenizer, processor) {
  let result = {
    metrics: {
      inferenceTime: 0,
      tokenizingTime: 0,
    },
  };
  let start = Date.now();
  let rawImage;

  if ("imageUrl" in request) {
    rawImage = await RawImage.fromUrl(request.imageUrl);
  } else {
    const blob = new Blob([request.data], { type: request.mimeType });
    rawImage = await RawImage.fromBlob(blob);
  }

  lazy.console.log("Image loaded in ", Date.now() - start);

  const { pixel_values } = await processor(rawImage);
  result.metrics.tokenizingTime += Date.now() - start;
  const toReturn = [];
  for (const batch of pixel_values) {
    batch.dims = [1, ...batch.dims];
    start = Date.now();
    const output = await model.generate(batch);
    result.metrics.inferenceTime += Date.now() - start;
    start = Date.now();
    const decoded = tokenizer
      .batch_decode(output, {
        skip_special_tokens: true,
      })
      .map(x => ({ generated_text: x.trim() }));
    result.metrics.tokenizingTime += Date.now() - start;
    toReturn.push(decoded);
  }
  lazy.console.log("Inference done in ", Date.now() - start);
  result.output = toReturn[0][0].generated_text;
  return result;
}

/**
 * Configuration for engine.
 *
 * @type {object}
 */
const ENGINE_CONFIGURATION = {
  "image-to-text": {
    model_id: "tarekziade/distilvit",
    model_class: AutoModelForVision2Seq,
    tokenizer_class: AutoTokenizer,
    processor_class: AutoProcessor,
    pipeline: image_to_text,
  },
};

/**
 * Converts an ArrayBuffer to a Blob URL.
 *
 * @param {ArrayBuffer} buffer - The ArrayBuffer to convert.
 * @returns {string} The Blob URL.
 */
function arrayBufferToBlobURL(buffer) {
  let blob = new Blob([buffer], { type: "application/wasm" });
  return URL.createObjectURL(blob);
}

/**
 * Represents a pipeline for processing machine learning tasks.
 */
class Pipeline {
  #worker;
  #model;
  #tokenizer;
  #processor;
  #task;
  #initTime;
  #pipeline;
  #status = {};

  /**
   * Creates an instance of a Pipeline.
   *
   * @param {object} worker - The worker used in the pipeline.
   * @param {string} modelId - The model ID used in the pipeline.
   * @param {object} modelClass - The model class used in the pipeline.
   * @param {object} tokenizer - The tokenizer used in the pipeline.
   * @param {object} processor - The processor used in the pipeline.
   * @param {string} task - The task name.
   * @param {Function} pipelineFunction - The function to run the pipeline.
   * @param {ArraybBuffer} runtime - The wasm runtime.
   * @param {number} initTime - The initialization time of the pipeline.
   */
  constructor(
    worker,
    modelId,
    modelClass,
    tokenizer,
    processor,
    task,
    pipelineFunction,
    runtime,
    initTime
  ) {
    env.useBrowserCache = false;
    env.allowLocalModels = false;
    env.remoteHost = "https://model-hub.mozilla.org";
    env.remotePathTemplate = "{model}";
    env.useCustomCache = true;
    env.backends.onnx.wasm.wasmPaths = {
      "ort-wasm-simd.wasm": arrayBufferToBlobURL(runtime),
    };
    this.#worker = worker;
    env.customCache = this.#worker;

    this.#model = modelClass.from_pretrained(modelId, {
      progress_callback: this.progressCallback.bind(this),
    });
    this.#tokenizer = tokenizer;
    this.#processor = processor;
    this.#task = task;
    this.#initTime = initTime;
    this.#pipeline = pipelineFunction.bind(this);
  }

  /**
   * Callback for progress updates.
   *
   * @param {object} progressStatus - The progress status.
   */
  progressCallback(progressStatus) {
    this.#status = JSON.stringify(progressStatus);
  }

  /**
   * Gets the status of the pipeline.
   *
   * @async
   * @returns {Promise<string>} The current status in JSON string format.
   */
  async getStatus() {
    return this.#status;
  }

  /**
   * Initializes the pipeline with given options.
   *
   * @static
   * @async
   * @param {object} worker - The worker used in the pipeline.
   * @param {object} options - The options for initialization.
   * @returns {Promise<Pipeline>} The initialized pipeline instance.
   */
  static async initialize(worker, options) {
    lazy.console.log("Initializing MLEngineWorker for task: ", options.task);

    let config = ENGINE_CONFIGURATION[options.task];
    let modelId = options.modelName ?? config.model_id;
    let pipelineFunction = config.pipeline;

    let start = Date.now();
    let tokenizer = config.tokenizer_class.from_pretrained(modelId);
    let processor;
    if (config.processor_class != null) {
      processor = await config.processor_class.from_pretrained(modelId);
    } else {
      processor = null;
    }

    let initTime = Date.now() - start;
    const pipeline = new Pipeline(
      worker,
      modelId,
      config.model_class,
      tokenizer,
      processor,
      options.task,
      pipelineFunction,
      options.runtime,
      initTime
    );
    lazy.console.log("MLEngineWorker is initialized, took ", initTime);
    return pipeline;
  }

  /**
   * Runs the pipeline with the given request.
   *
   * @async
   * @param {object} request - The request object.
   * @returns {Promise<object>} The result object from the pipeline execution.
   */
  async run(request) {
    this.#model = await this.#model;
    this.#tokenizer = await this.#tokenizer;
    lazy.console.log("Running task: ", this.#task);
    let result = await this.#pipeline(
      request,
      this.#model,
      this.#tokenizer,
      this.#processor
    );
    result.metrics.initTime = this.#initTime;
    return result;
  }
}

export { Pipeline };
