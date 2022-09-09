/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

import { Redux } from "./vendor.js";

/**
 * @param {string} state
 * @param {ContentCache.Action} action
 */
function searchString(state = "", action) {
  switch (action.type) {
    case "set-search-string":
      return action.search;
    default:
      return state;
  }
}

/**
 * @param {ContentCache.HistoryRow[]} state
 * @param {ContentCache.Action} action
 */
function historyRows(state = [], action) {
  switch (action.type) {
    case "set-history-rows":
      return action.rows;
    default:
      return state;
  }
}

export const reducers = Redux.combineReducers({ searchString, historyRows });
