/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const EXPORTED_SYMBOLS = ["PyodideService"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);

if (!AppConstants.PINEBUILD) {
  throw new Error(
    "We should not be instantiating the PyodideService if pinebuild is not enabled."
  );
}

XPCOMUtils.defineLazyModuleGetters(this, {
  E10SUtils: "resource://gre/modules/E10SUtils.jsm",
  HiddenFrame: "resource://gre/modules/HiddenFrame.jsm",
  Services: "resource://gre/modules/Services.jsm",
});

XPCOMUtils.defineLazyGetter(this, "logConsole", function() {
  return console.createInstance({
    prefix: "PyodideService",
    maxLogLevel: Services.prefs.getBoolPref(
      "browser.companion.pyodide.log",
      false
    )
      ? "Debug"
      : "Info",
  });
});

/**
 * loadContentWindow is a utility function that loads the provided url in the given browser.
 */
function loadContentWindow(browser, url) {
  let uri;
  try {
    uri = Services.io.newURI(url);
  } catch (e) {
    let msg = `Invalid URL passed to loadContentWindow(): ${url}`;
    Cu.reportError(msg);
    throw new Error(msg);
  }

  const principal = Services.scriptSecurityManager.getSystemPrincipal();
  let oa = E10SUtils.predictOriginAttributes({
    browser,
  });
  let loadURIOptions = {
    triggeringPrincipal: principal,
    remoteType: E10SUtils.getRemoteTypeForURI(
      url,
      true,
      false,
      E10SUtils.DEFAULT_REMOTE_TYPE,
      null,
      oa
    ),
  };
  browser.loadURI(uri.spec, loadURIOptions);
}

/**
 * The PyodideService provides api to Pyodide, exposing the machine learning library scikit-learn.
 */
const PyodideService = {
  /**
   * This stores the browser created to load the pyodide content
   *
   * @type {Browser}
   */
  _browser: null,

  /**
   * Currently only initializing by pref (defaulting to false).
   * Register the actors, add observers.
   */
  init() {
    if (!Services.prefs.getBoolPref("browser.companion.pyodide", false)) {
      return;
    }

    ChromeUtils.registerWindowActor("Pyodide", {
      parent: {
        moduleURI: "resource:///actors/PyodideParent.jsm",
      },
      child: {
        moduleURI: "resource:///actors/PyodideChild.jsm",
        events: {
          pyodideReady: { wantUntrusted: true, capture: true },
        },
      },
      matches: ["resource://pyodide/pyodide.html"],
    });

    Services.obs.addObserver(this, "interactions-exported");
    logConsole.debug("PyodideService init");
  },

  /**
   * Create the browser and load the pyodide content.
   * We load pyodide in its own content window because the library makes use of 'eval()'
   * and this is thus not permitted nor safe to run in the chrome process.
   */
  async loadContent() {
    let frame = new HiddenFrame();
    let windowlessBrowser = await frame.get();
    let doc = windowlessBrowser.document;

    this._browser = doc.createXULElement("browser");
    this._browser.setAttribute("remote", "true");
    this._browser.setAttribute("type", "content");
    this._browser.setAttribute("maychangeremoteness", "true");
    doc.documentElement.appendChild(this._browser);

    let browserReadyPromise = new Promise(resolve => {
      this._browser.addEventListener("pyodideReady", resolve, { once: true });
    });

    loadContentWindow(this._browser, "resource://pyodide/pyodide.html");

    await browserReadyPromise;
  },

  /**
   * Executes the given python script with the provided context.
   *
   * @param {String} script
   *   The python script to be executed by Pyodide
   * @param {Object} context
   *   A context for execution, generally including data to be processed. e.g.  { inputs: [0.12, 0.41, 19, 19] }
   */
  async executePython(script, context) {
    if (!this._browser) {
      await this.loadContent();
    }

    let actor = this._browser.browsingContext.currentWindowGlobal.getActor(
      "Pyodide"
    );

    const { results, error } = await actor.sendQuery("execute", {
      script,
      context,
    });

    return { results, error };
  },

  /**
   * Respond to observer topics
   */
  async observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "interactions-exported":
        logConsole.debug("Received 'interactions-exported'");

        if (!this._browser) {
          await this.loadContent();
        }

        const interactions = JSON.parse(aData);
        if (interactions.length) {
          let headers = Object.keys(interactions[0]);
          // Create a row for each interaction
          let rows = interactions.map(item => headers.map(prop => item[prop]));

          const { results, error } = await this.executePython(
            `
              from js import rows_js
              from js import headers_js
              import numpy as np
              import pandas as pd

              df = pd.DataFrame(rows_js, columns = headers_js)
              output = "DataFrame shape: " + str(df.shape) + " DataFrame columns: " + str(df.columns)
              output
            `,
            {
              rows_js: rows,
              headers_js: headers,
            }
          );

          if (results) {
            logConsole.info("Pyodide interactions results ", results);
          }
          if (error) {
            logConsole.info("Pyodide interactions error: ", error);
          }
        }
    }
  },

  /**
   * A simple test case to demonstrate usage of pyodide.
   * Makes use of numpy and sklearn.
   */
  async testPyodide() {
    const { results, error } = await this.executePython(
      `
      import numpy as np
      from sklearn import datasets
      iris_X, iris_y = datasets.load_iris(return_X_y=True)
      np.unique(iris_y).tolist()
      `,
      {}
    );

    if (results) {
      logConsole.info("testLoadPyodide Pyodide results ", results);
    }
    if (error) {
      logConsole.info("testLoadPyodide Pyodide error: ", error);
    }
  },

  /**
   *  Release the browser, remove observers.
   */
  uninit() {
    if (!Services.prefs.getBoolPref("browser.companion.pyodide", false)) {
      return;
    }
    this._browser = null;
    Services.obs.removeObserver(this, "interactions-exported");
  },
};
