/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const lazy = {};

ChromeUtils.defineLazyGetter(lazy, "console", () => {
  return console.createInstance({
    maxLogLevelPref: "browser.translations.logLevel",
    prefix: "Translations",
  });
});

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
        const transferables = [port];
        const message = {
          type: "StartTranslation",
          fromLanguage,
          toLanguage,
          innerWindowId,
          port,
        };
        this.contentWindow.postMessage(message, "*", transferables);
        break;
      }
      case "TranslationsEngine:DiscardTranslations": {
        const { fromLanguage, toLanguage, innerWindowId, closePort } = data;
        this.contentWindow.postMessage({
          type: "DiscardTranslations",
          fromLanguage,
          toLanguage,
          innerWindowId,
          closePort,
        });
        break;
      }
      default:
        console.error("Unknown message received", name);
    }
  }

  /**
   * Export any of the child functions that start with "TE_" to the unprivileged content
   * page. This restricts the security capabilities of the content page.
   */
  #exportFunctions() {
    const fns = [
      "TE_addProfilerMarker",
      "TE_getLogLevel",
      "TE_log",
      "TE_logError",
      "TE_requestEnginePayload",
      "TE_reportEngineStatus",
      "TE_notifyAllEnginesRemoved",
      "TE_notifyEnginesPresent",
    ];
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
   * @param {Object} options
   * @param {number?} options.startTime
   * @param {string} options.message
   */
  TE_addProfilerMarker({ startTime, message, innerWindowId }) {
    ChromeUtils.addProfilerMarker(
      "TranslationsEngine",
      { startTime, innerWindowId },
      message
    );
  }

  /**
   * @returns {string}
   */
  TE_getLogLevel() {
    return Services.prefs.getCharPref("browser.translations.logLevel");
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
      this.sendQuery("TranslationsEngine:RequestEnginePayload", {
        fromLanguage,
        toLanguage,
      })
    );
  }

  /**
   * @param {number} innerWindowId
   * @param {"ready" | "error"} status
   */
  TE_reportEngineStatus(innerWindowId, status) {
    this.sendAsyncMessage("TranslationsEngine:ReportEngineStatus", {
      innerWindowId,
      status,
    });
  }

  /**
   * When all the engines are removed, this process can be removed. The process
   * will only be removed when the TranslationsParent decides to do so.
   */
  TE_notifyAllEnginesRemoved() {
    this.sendAsyncMessage("TranslationsEngine:AllEnginesRemoved");
  }

  /**
   * A content page can retain a handle on a message port, and when used will
   * recreate a translations engine.
   */
  TE_notifyEnginesPresent() {
    this.sendAsyncMessage("TranslationsEngine:EnginesPresent");
  }
}
