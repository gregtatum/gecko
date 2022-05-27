/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * @ts-check */

const { BrowserLoader } = ChromeUtils.import(
  "resource://devtools/shared/loader/browser-loader.js"
);
const { require } = BrowserLoader({
  baseURI: "resource://devtools/client/performance-new/",
  window,
});

/** @type {import("react")} */
export const React = require("devtools/client/shared/vendor/react");
/** @type {import("redux")} */
export const Redux = require("devtools/client/shared/vendor/redux");
/** @type {import("react-dom")} */
export const ReactDOM = require("devtools/client/shared/vendor/react-dom");
/** @type {import("react-redux")} */
export const ReactRedux = require("devtools/client/shared/vendor/react-redux");
/** @type {import("reselect")} */
export const reselect = require("devtools/client/shared/vendor/reselect");
/** @type {import("react-dom-factories")} */
export const ReactDOMFactories = require("devtools/client/shared/vendor/react-dom-factories");
/** @type {import("devtools/client/shared/redux/create-store")} */
export const createStore = require("devtools/client/shared/redux/create-store");
