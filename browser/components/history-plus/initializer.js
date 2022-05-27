/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
// @ts-check

import {
  ReactDOM,
  ReactDOMFactories,
  React,
  createStore,
  ReactRedux,
} from "./src/vendor.js";
import { reducers } from "./src/reducers.js";
import * as actions from "./src/actions.js";

const store = createStore(reducers);

store.dispatch(
  actions.initializeStore({
    history: [],
  })
);

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Could not find the root element.");
}

const historyServices = Cc[
  "@mozilla.org/browser/nav-history-service;1"
].getService(Ci.nsINavHistoryService);

ReactDOM.render(
  React.createElement(
    ReactRedux.Provider,
    { store },
    ReactDOMFactories.div(null, "This works")
  ),
  root
);
