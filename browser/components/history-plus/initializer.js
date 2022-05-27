/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
// @ts-check

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

import { ReactDOM, React, Redux, ReactRedux } from "./src/vendor.js";
import { reducers } from "./src/reducers.js";
import { HistoryPlus } from "./src/components.js";
import { reduxLogger, thunkMiddleware } from "./src/utils.js";

/** @type {any[]} */
const middleware = [thunkMiddleware];
if (Services.prefs.getCharPref("browser.contentCache.logLevel") === "All") {
  // Only add the logger if it is required, since it fires for every action.
  middleware.push(reduxLogger);
}

const store = Redux.createStore(reducers, Redux.applyMiddleware(...middleware));

Object.assign(/** @type {any} */(window), {
  store,
  getState: store.getState,
  dispatch: store.dispatch,
});

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Could not find the root element.");
}

ReactDOM.render(
  React.createElement(
    ReactRedux.Provider,
    { store },
    React.createElement(HistoryPlus)
  ),
  root
);

/** @type {any} */ (window).store = store;
/** @type {any} */ (window).getState = store.getState;
/** @type {any} */ (window).dispatch = store.dispatch;
