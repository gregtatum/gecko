/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ReactDOM, React, Redux, ReactRedux } from "./contentcache/vendor.mjs";
import { reducers } from "./contentcache/reducers.mjs";
import { ContentCache } from "./contentcache/components.mjs";
import { reduxLogger, thunkMiddleware } from "./contentcache/utils.mjs";

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
    React.createElement(ContentCache)
  ),
  root
);

/** @type {any} */ (window).store = store;
/** @type {any} */ (window).getState = store.getState;
/** @type {any} */ (window).dispatch = store.dispatch;
