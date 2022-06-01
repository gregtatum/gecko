/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
// @ts-check

import { ReactDOM, React, Redux, ReactRedux } from "./src/vendor.js";
import { reducers } from "./src/reducers.js";
import * as actions from "./src/actions-plain.js";
import { HistoryPlus } from "./src/components.js";

const store = Redux.createStore(reducers);

store.dispatch(actions.initializeStore());

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
