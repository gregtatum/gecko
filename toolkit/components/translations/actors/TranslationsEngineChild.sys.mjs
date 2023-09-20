/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * The engine child is responsible for exposing privileged code to the un-privileged
 * space the engine runs in.
 */
export class TranslationsEngineChild extends JSWindowActorChild {
  actorCreated() {
    this.#exportFunctions();
  }

  async receiveMessage({ name, data }) {
    switch (name) {
      case "TranslationsEngine:StartTranslation": {
        const { fromLanguage, toLanguage, innerWindowId, port } = data;
        this.#sendEventToContent({
          type: "StartTranslation",
          fromLanguage,
          toLanguage,
          innerWindowId,
          port: Cu.cloneInto(port, this.contentWindow),
        });
        break;
      }
      case "TranslationsEngine:EndTranslation":
        this.#sendEventToContent({
          type: "EndTranslation",
          translationsId: data.translationsId,
        });
        break;
      default:
        console.error("Unknown message received", name);
    }
  }

  /**
   * @param {object} detail
   */
  #sendEventToContent(detail) {
    this.contentWindow.dispatchEvent(
      new this.contentWindow.CustomEvent("TranslationsEngineChromeToContent", {
        detail: Cu.cloneInto(detail, this.contentWindow),
      })
    );
  }

  /**
   * Export any of the child functions that start with "TE_" to the unprivileged content
   * page. This restricts the security capabilities of the content page.
   */
  #exportFunctions() {
    const fns = ["TE_log", "TE_logError", "TE_requestEnginePayload"];
    for (const defineAs of fns) {
      Cu.exportFunction(this[defineAs].bind(this), this.contentWindow, {
        defineAs,
      });
    }
  }

  /**
   * A privileged promise can't be used in the content page, so convert a privileged
   * promise into a content one.
   *
   * @param {Promise<any>} promise
   * @returns {Promise<any>}
   */
  #convertToContentPromise(promise) {
    return new this.contentWindow.Promise((resolve, reject) =>
      promise.then(resolve, error => {
        let contentWindow;
        try {
          contentWindow = this.contentWindow;
        } catch (error) {
          // The content window is no longer available.
          reject();
          return;
        }
        // Create an error in the content window, if the content window is still around.
        let message = "An error occured in the TranslationsEngine actor.";
        if (typeof error === "string") {
          message = error;
        }
        if (typeof error?.message === "string") {
          message = error.message;
        }
        if (typeof error?.stack === "string") {
          message += `\n\nOriginal stack:\n\n${error.stack}\n`;
        }

        reject(new contentWindow.Error(message));
      })
    );
  }

  /**
   * Log messages if "browser.translations.logLevel" is set to "All".
   *
   * @param {...any} args
   */
  TE_log(...args) {
    lazy.console.log(...args);
  }

  /**
   * Report an error to the console.
   *
   * @param {...any} args
   */
  TE_logError(...args) {
    lazy.console.error(...args);
  }

  /**
   * @param {string} fromLanguage
   * @param {string} toLanguage
   */
  TE_requestEnginePayload(fromLanguage, toLanguage) {
    return this.#convertToContentPromise(
      this.sendAsyncMessage("TranslationsEngine:RequestEnginePayload", {
        fromLanguage,
        toLanguage,
      })
    );
  }

  /**
   * @param {Object} options
   * @param {number?} options.startTime
   * @param {string} options.message
   */
  TE_addProfilerMarker({ startTime, message }) {
    ChromeUtils.addProfilerMarker("TranslationsEngine", { startTime }, message);
  }
}
