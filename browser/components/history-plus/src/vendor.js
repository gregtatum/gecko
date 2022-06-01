/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

/**
 * This file loads all of the vendor files, and re-exports them using ES modules.
 */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { BrowserLoader } = ChromeUtils.import(
  "resource://devtools/shared/loader/browser-loader.js"
);
const { require } = BrowserLoader({
  baseURI: "resource://devtools/client/performance-new/",
  window,
});

Services.scriptloader.loadSubScript(
  "resource://activity-stream/vendor/redux.js",
  window
)

Services.scriptloader.loadSubScript(
  "resource://activity-stream/vendor/react.js",
  window
)

Services.scriptloader.loadSubScript(
  "resource://activity-stream/vendor/react-dom.js",
  window
)

Services.scriptloader.loadSubScript(
  "resource://activity-stream/vendor/react-redux.js",
  window
)

/**
 * Coerce to any to read values off the global object.
 * @type {any}
 */
const win = window;

/** @type {import("react")} */
export const React = win.React;

/** @type {import("redux")} */
export const Redux = win.Redux;

/** @type {import("react-dom")} */
export const ReactDOM = win.ReactDOM;

/** @type {import("react-redux")} */
export const ReactRedux = win.ReactRedux;

/** @type {import("reselect")} */
export const reselect = require("devtools/client/shared/vendor/reselect");

/** @type {import("react-dom-factories")} */
export const ReactDOMFactories = require("devtools/client/shared/vendor/react-dom-factories");
