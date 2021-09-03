/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const EXPORTED_SYMBOLS = ["OnnxRuntimeService"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);

if (!AppConstants.PINEBUILD) {
  throw new Error(
    "We should not be instantiating the OnnxRuntimeService if pinebuild is not enabled."
  );
}

XPCOMUtils.defineLazyModuleGetters(this, {
  E10SUtils: "resource://gre/modules/E10SUtils.jsm",
  HiddenFrame: "resource://gre/modules/HiddenFrame.jsm",
  Services: "resource://gre/modules/Services.jsm",
});

XPCOMUtils.defineLazyGetter(this, "logConsole", function() {
  return console.createInstance({
    prefix: "OnnxRuntimeService",
    maxLogLevel: Services.prefs.getBoolPref("browser.companion.onnx.log", false)
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
 * The OnnxRuntimeService provides api to the ONNX runtime machine learning inference tooling.
 */
const OnnxRuntimeService = {
  /**
   * This stores the browser created to load the onnx content
   *
   * @type {Browser}
   */
  _browser: null,

  /**
   * Currently only initializing by pref (defaulting to false).
   * Add observers if initializing.
   */
  init() {
    if (!Services.prefs.getBoolPref("browser.companion.onnx", false)) {
      return;
    }

    logConsole.debug("OnnxRuntimeService init");

    ChromeUtils.registerWindowActor("ORT", {
      parent: {
        moduleURI: "resource:///actors/ORTParent.jsm",
      },
      child: {
        moduleURI: "resource:///actors/ORTChild.jsm",
        events: {
          ortReady: { wantUntrusted: true, capture: true },
        },
      },
      matches: ["resource://ort/ort.html"],
    });

    Services.obs.addObserver(this, "interaction-added");
  },

  /**
   * Respond to observer topics
   */
  async observe(aSubject, aTopic, aData) {
    switch (aTopic) {
      case "interaction-added":
        logConsole.debug("Received 'interaction-added': " + aData);

        if (!this._browser) {
          await this.loadScript();
        }

        const interaction = JSON.parse(aData);
        let actor = this._browser.browsingContext.currentWindowGlobal.getActor(
          "ORT"
        );
        // Test model parameters
        let results = await actor.sendQuery("execute", {
          float_input: {
            floats: [interaction.keypresses, interaction.totalViewTime],
            values: [1, 2],
          },
        });
        logConsole.info(
          "OnnxRuntimeService likelihood scores: ",
          results.probabilities.data
        );
    }
  },

  /**
   * Create the browser and load the onnx script.
   */
  async loadScript() {
    logConsole.debug("OnnxRuntimeService loadScript");
    let frame = new HiddenFrame();
    let windowlessBrowser = await frame.get();
    let doc = windowlessBrowser.document;

    this._browser = doc.createXULElement("browser");
    this._browser.setAttribute("remote", "true");
    this._browser.setAttribute("type", "content");
    this._browser.setAttribute("maychangeremoteness", "true");
    doc.documentElement.appendChild(this._browser);

    let browserReadyPromise = new Promise(resolve => {
      this._browser.addEventListener("ortReady", resolve, { once: true });
    });

    loadContentWindow(this._browser, "resource://ort/ort.html");

    await browserReadyPromise;
  },

  /**
   * Release the browser and remove observers.
   */
  uninit() {
    if (!Services.prefs.getBoolPref("browser.companion.onnx", false)) {
      return;
    }

    this._browser = null;
    Services.obs.removeObserver(this, "interaction-added");
  },
};
