/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * @typedef {object} Lazy
 * @property {typeof console} console
 * @property {typeof import("../content/EngineProcess.sys.mjs").EngineProcess} EngineProcess
 */

/** @type {Lazy} */
const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.ml.logLevel",
    prefix: "ML",
  });
});

ChromeUtils.defineESModuleGetters(lazy, {
  EngineProcess: "chrome://global/content/ml/EngineProcess.sys.mjs",
});

const DEFAULT_CACHE_TIMEOUT_MS = 15_000;

/**
 * The ML engine is in its own content process. This actor handles the
 * marshalling of the data such as the engine payload.
 */
export class MLEngineParent extends JSWindowActorParent {
  /**
   * @param {string} engineName
   * @param {*} options
   * @param {number} cacheTimeoutMS - How long the engine cache remains alive between
   *   uses, in milliseconds. In automation the engine is manually created and destroyed
   *   to avoid timing issues.
   * @returns {MLEngine}
   */
  getEngine(
    engineName,
    options = {},
    cacheTimeoutMS = DEFAULT_CACHE_TIMEOUT_MS
  ) {
    return new MLEngine(this, engineName, options, cacheTimeoutMS);
  }

  // eslint-disable-next-line consistent-return
  async receiveMessage({ name, data }) {
    switch (name) {
      case "MLEngine:Ready":
        if (lazy.EngineProcess.resolveMLEngineParent) {
          lazy.EngineProcess.resolveMLEngineParent(this);
        } else {
          lazy.console.error(
            "Expected #resolveMLEngineParent to exist when then ML Engine is ready."
          );
        }
        break;
      case "MLEngine:DestroyEngineProcess":
        lazy.EngineProcess.destroyMLEngine().catch(error =>
          console.error(error)
        );
        break;
    }
  }

  /**
   * Send a message to gracefully shutdown all of the ML engines in the engine process.
   * This mostly exists for testing the shutdown paths of the code.
   */
  forceShutdown() {
    return this.sendQuery("MLEngine:ForceShutdown");
  }
}

/**
 * This contains all of the information needed to perform a translation request.
 *
 * @typedef {object} TranslationRequest
 * @property {Node} node
 * @property {string} sourceText
 * @property {boolean} isHTML
 * @property {Function} resolve
 * @property {Function} reject
 */

/**
 * The interface to communicate to an MLEngine in the parent process. The engine manages
 * its own lifetime, and is kept alive with a timeout. A reference to this engine can
 * be retained, but once idle, the engine will be destroyed. If a new request to run
 * is sent, the engine will be recreated on demand. This balances the cost of retaining
 * potentially large amounts of memory to run models, with the speed and ease of running
 * the engine.
 *
 * @template Request
 * @template Response
 */
class MLEngine {
  /**
   * @type {MessagePort | null}
   */
  #port = null;

  #nextRequestId = 0;

  /**
   * Tie together a message id to a resolved response.
   *
   * @type {Map<number, PromiseWithResolvers<Request>>}
   */
  #requests = new Map();

  /**
   * @type {"uninitialized" | "ready" | "error" | "closed"}
   */
  engineStatus = "uninitialized";

  /**
   * @param {MLEngineParent} mlEngineParent
   * @param {string} engineName
   * @param {*} options
   * @param {number} timeoutMS
   */
  constructor(mlEngineParent, engineName, options, timeoutMS) {
    /** @type {MLEngineParent} */
    this.mlEngineParent = mlEngineParent;
    /** @type {string} */
    this.engineName = engineName;
    /** @type {number} */
    this.timeoutMS = timeoutMS;
    this.options = options;

    this.#setupPortCommunication();
  }

  /**
   * Create a MessageChannel to communicate with the engine directly.
   */
  #setupPortCommunication() {
    const { port1: childPort, port2: parentPort } = new MessageChannel();
    const transferables = [childPort];
    this.#port = parentPort;
    this.#port.onmessage = this.handlePortMessage;
    this.mlEngineParent.sendAsyncMessage(
      "MLEngine:NewPort",
      {
        port: childPort,
        engineName: this.engineName,
        options: this.options,
        timeoutMS: this.timeoutMS,
      },
      transferables
    );
  }

  handlePortMessage = ({ data }) => {
    switch (data.type) {
      case "EnginePort:RunResponse": {
        const { response, error, requestId } = data;
        const request = this.#requests.get(requestId);
        if (request) {
          if (response) {
            request.resolve(response);
          } else {
            request.reject(error);
          }
        } else {
          lazy.console.error(
            "Could not resolve response in the MLEngineParent",
            data
          );
        }
        this.#requests.delete(requestId);
        break;
      }
      case "EnginePort:EngineTerminated": {
        // The engine was terminated, and if a new run is needed a new port
        // will need to be requested.
        this.engineStatus = "closed";
        this.discardPort();
        break;
      }
      default:
        lazy.console.error("Unknown port message from engine", data);
        break;
    }
  };

  discardPort() {
    if (this.#port) {
      this.#port.postMessage({ type: "EnginePort:Discard" });
      this.#port.close();
      this.#port = null;
    }
  }

  terminate() {
    this.#port.postMessage({ type: "EnginePort:Terminate" });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Response>}
   */
  run(request) {
    const resolvers = Promise.withResolvers();
    const requestId = this.#nextRequestId++;
    this.#requests.set(requestId, resolvers);
    this.#port.postMessage({
      type: "EnginePort:Run",
      requestId,
      request,
    });
    return resolvers.promise;
  }
}
