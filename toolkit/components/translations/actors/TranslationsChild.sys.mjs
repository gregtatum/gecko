/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

import { XPCOMUtils } from "resource://gre/modules/XPCOMUtils.sys.mjs";

XPCOMUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});









//============================
// Erik Code Start
//============================

// var modelFastTextReadyPromise = null;
var modelFastText = null;

// loads fasttext (language detection) wasm module and model

// modelFastTextReadyPromise =
//   fetch("chrome://global/content/translations/fasttext_wasm.wasm")
//     .then(function(response) {
//         return response.arrayBuffer();
//     })
//     .then(function(wasmArrayBuffer) {
//       lazy.console.log(wasmArrayBuffer);
//     //  return new Promise(resolve => {
//     //    const modelUrl = browser.runtime.getURL("model/static/languageDetection/lid.176.ftz");
//     //    const initialModule = {
//     //        onRuntimeInitialized() {
//     //            const ft = new FastText(initialModule);
//     //            resolve(ft.loadModel(modelUrl));
//     //        },
//     //        wasmBinary: wasmArrayBuffer,
//     //    };
//     //    loadFastText(initialModule);
//     //  });
//     })
//     .then(model => {
//       //modelFastText = model;
//       modelFastText = true;
//     });

// //import {FastText, addOnPostRun} from "./fasttext.js";
lazy.console.log("Is this running?");
import {FastText} from "chrome://global/content/translations/fasttextexport.js";
// // importScripts("chrome://global/content/translations/fasttext.js");



//============================
// Erik Code End
//============================



























/**
 * @typedef {import("../translations").LanguageModelFiles} LanguageModelFiles
 */

/**
 * The TranslationsEngine encapsulates the logic for translating messages. It can
 * only be set up for a single language translation pair. In order to change languages
 * a new engine should be constructed.
 *
 * The actual work for the translations happens in a worker. This class manages
 * instantiating and messaging the server.
 */
export class TranslationsEngine {
  /** @type {Worker} */
  #worker;
  /** @type {Worker} */
  #languageIdWorker;
  #messageGeneration = 0;

  /**
   * Construct and initialize the worker.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @param {ArrayBuffer} bergamotWasmArrayBuffer
   * @param {LanguageModelFiles[]} languageModelFiles
   */
  constructor(
    fromLanguage,
    toLanguage,
    bergamotWasmArrayBuffer,
    languageModelFiles
  ) {
    /** @type {string} */
    this.fromLanguage = fromLanguage;
    /** @type {string} */
    this.toLanguage = toLanguage;
    this.#worker = new Worker(
      "chrome://global/content/translations/engine-worker.js"
    );

    /** @type {Promise<void>} */
    this.isReady = new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        lazy.console.log("Received initialization message", data);
        if (data.type === "initialization-success") {
          resolve();
        } else if (data.type === "initialization-failure") {
          reject(data.error);
        }
        this.#worker.removeEventListener("message", onMessage);
      };
      this.#worker.addEventListener("message", onMessage);
    });

    this.#worker.postMessage({
      type: "initialize",
      fromLanguage,
      toLanguage,
      bergamotWasmArrayBuffer,
      languageModelFiles,
      messageGeneration: this.#messageGeneration++,
      isLoggingEnabled:
        Services.prefs.getCharPref("browser.translations.logLevel") === "All",
    });
  }

  /**
   * @param {string[]} messageBatch
   * @returns {Promise<string>}
   */
  translate(messageBatch) {
    const generation = this.#messageGeneration++;
    lazy.console.log("Translating", messageBatch);

    return new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        lazy.console.log("Received message", data);
        if (data.generation !== generation) {
          // This message was for someone else.
          return;
        }
        if (data.type === "translation-response") {
          resolve(data.translations);
        }
        if (data.type === "translation-error") {
          reject(data.error);
        }
        this.#worker.removeEventListener("message", onMessage);
      };

      this.#worker.addEventListener("message", onMessage);

      this.#worker.postMessage({
        type: "translation-request",
        messageBatch,
        generation,
      });
    });
  }

  /**
   * The worker should be GCed just fine on its own, but go ahead and signal to
   * the worker that it's no longer needed. This will immediately cancel any in-progress
   * translations.
   */
  terminate() {
    this.#worker.terminate();
  }
}

function testTheThing() {

}

/**
 * See the TranslationsParent for documentation.
 */
export class TranslationsChild extends JSWindowActorChild {
  /**
   * The data for the Bergamot translation engine is downloaded from Remote Settings
   * and cached to disk. It is retained here in child process in case the translation
   * language switches.
   *
   * At the time of this writing ~5mb.
   *
   * @type {ArrayBuffer | null}
   */
  #bergamotWasmArrayBuffer = null;

  /**
   * @returns {Promise<ArrayBuffer>}
   */
  async #getBergamotWasmArrayBuffer() {
    let arrayBuffer = this.#bergamotWasmArrayBuffer;
    if (!arrayBuffer) {
      arrayBuffer = await this.sendQuery(
        "Translations:GetBergamotWasmArrayBuffer"
      );
      this.#bergamotWasmArrayBuffer = arrayBuffer;
    }
    return arrayBuffer;
  }

  /**
   * @returns {Promise<ArrayBuffer>}
   */
  #getLanguageIdentificationModel() {
    return this.sendQuery("Translations:GetLanguageIdentificationModel");
  }

  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   * @returns {Promise<LanguageModelFiles[]>}
   */
  async #getLanguageModelFiles(fromLanguage, toLanguage) {
    return this.sendQuery("Translations:GetLanguageModelFiles", {
      fromLanguage,
      toLanguage,
    });
  }

  /**
   * @param {{ type: string }} event
   */
  handleEvent(event) {
    // TODO
    //lazy.console.log("TranslationsChild observed a pageshow event.");
    //let text = "¡Hola! ¿Cómo estás?";
    //this.detectLanguage(text)
  }

  async detectLanguage(text) {
    let response = await fetch("chrome://global/content/translations/fasttext_wasm.wasm");
    let wasmBuffer = await response.arrayBuffer();
    lazy.console.log("buffer contents: ", wasmBuffer);
    let modelBuffer = await this.#getLanguageIdentificationModel();

    lazy.console.log("Initializing LanguageID Worker");
    var worker = new Worker(
      "chrome://global/content/translations/language-id-worker.js"
    );

    /** @type {Promise<void>} */
    var isReady = new Promise((resolve, reject) => {
      lazy.console.log("HMMM!?1");
      const onMessage = ({ data }) => {
        lazy.console.log("Received LID initialization message", data);
        if (data.type === "initialization-success") {
          resolve();
        } else if (data.type === "initialization-failure") {
          reject(data.error);
        }
        worker.removeEventListener("message", onMessage);
      };
      lazy.console.log("HMMM!?2");
      worker.addEventListener("message", onMessage);
      lazy.console.log("HMMM!?3");
    });



    worker.postMessage({
      type: "initialize",
      modelBuffer,
      wasmBuffer,
      isLoggingEnabled:
        Services.prefs.getCharPref("browser.translations.logLevel") === "All",
    });


    lazy.console.log("Test 1");
    await isReady;
    lazy.console.log(worker);
    lazy.console.log("Test 2");
    //await this.identify(worker, text);

    lazy.console.log("Identifying", text);
    lazy.console.log(worker);

    return new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        lazy.console.log("Received message", data);
        if (data.type === "language-id-response") {
          resolve(data.translations);
        }
        if (data.type === "language-id-error") {
          reject(data.error);
        }
        worker.removeEventListener("message", onMessage);
      };

      lazy.console.log("Adding event listener");
      worker.addEventListener("message", onMessage);

      lazy.console.log("Posting message");
      worker.postMessage({
        type: "language-id-request",
        text
      });
    });



    lazy.console.log("Test 3");
  }

  /**
   * @param {string[]} messageBatch
   * @returns {Promise<string>}
   */
  identify(worker, text) {
    lazy.console.log("Identifying", text);
    lazy.console.log(worker);

    return new Promise((resolve, reject) => {
      const onMessage = ({ data }) => {
        lazy.console.log("Received message", data);
        if (data.type === "language-id-response") {
          resolve(data.translations);
        }
        if (data.type === "language-id-error") {
          reject(data.error);
        }
        worker.removeEventListener("message", onMessage);
      };

      lazy.console.log("Adding event listener");
      worker.addEventListener("message", onMessage);

      lazy.console.log("Posting message");
      worker.postMessage({
        type: "language-id-request",
        text
      });
    });
  }

  // /**
  //  * The worker should be GCed just fine on its own, but go ahead and signal to
  //  * the worker that it's no longer needed. This will immediately cancel any in-progress
  //  * translations.
  //  */
  // terminate() {
  //   this.#worker.terminate();
  // }


  /**
   * Get the list of languages and their display names, sorted by their display names.
   *
   * TODO - Not all languages have bi-directional translations, like Icelandic. These
   * are listed as "Beta" in the addon. This list should be changed into a "from" and
   * "to" list, and the logic enhanced in the dropdowns to only allow valid translations.
   *
   * @returns {Promise<Array<{ langTag: string, displayName }>>}
   */
  getSupportedLanguages() {
    return this.sendQuery("Translations:GetSupportedLanguages");
  }

  /**
   * Construct and initialize the Translations Engine.
   *
   * @param {string} fromLanguage
   * @param {string} toLanguage
   */
  async createTranslationsEngine(fromLanguage, toLanguage) {
    lazy.console.log("CREATING TRANSLATION ENGINE");
    const [bergamotWasmArrayBuffer, languageModelFiles] = await Promise.all([
      this.#getBergamotWasmArrayBuffer(),
      this.#getLanguageModelFiles(fromLanguage, toLanguage),
    ]);

    const engine = new TranslationsEngine(
      fromLanguage,
      toLanguage,
      bergamotWasmArrayBuffer,
      languageModelFiles
    );

    await engine.isReady;

//============================
// Erik Code Start
//============================

    // lazy.console.log("\nv\nv\nv\nGETTING MODEL RECORDS");
    // const languageIdRecords = await this.#getLanguageIdentificationModelRecords();
    // lazy.console.log(languageIdRecords);
    // lazy.console.log("\n^\n^\n^\n");


    // lazy.console.log("\nv\nv\nv\nLOCATION");
    // let location = languageIdRecords[0].attachment.location;
    // lazy.console.log(location);
    // lazy.console.log("\n^\n^\n^\n");

    //lazy.console.log("\nv\nv\nv\nFastText instance");
    //let ft = new FastText();
    //lazy.console.log(ft);
    //lazy.console.log("\n^\n^\n^\n");

    //addOnPostRun(() => {
    //    let ft = new FastText();

    //    const url = location;
    //    ft.loadModel(url).then(model => {

    //        lazy.console.log("Model loaded.")

    //        let text = "Bonjour à tous. Ceci est du français";
    //        lazy.console.log(text);
    //        printVector(model.predict(text, 5, 0.0));

    //        text = "Hello, world. This is english";
    //        lazy.console.log(text);
    //        printVector(model.predict(text, 5, 0.0));

    //        text = "Merhaba dünya. Bu da türkçe"
    //        lazy.console.log(text);
    //        printVector(model.predict(text, 5, 0.0));
    //    });
    //});

    //await fetchBuffer();
    //await modelFastTextReadyPromise;
    lazy.console.log("\nv\nv\nv\nmodelFastText: ", modelFastText);
    lazy.console.log("\n^\n^\n^\n");

    let text = "¡Hola! ¿Cómo estás?";
    await this.detectLanguage(text);


//============================
// Erik Code End
//============================

    return engine;
  }
}
