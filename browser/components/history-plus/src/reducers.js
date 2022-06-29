/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

import { Redux } from "./vendor.js";

/**
 * @param {string} state
 * @param {HistoryPlus.Action} action
 */
function searchString(state = "", action) {
  switch (action.type) {
    case "set-search-string":
      return action.search;
    case "add-site-to-search-string": {
      const index = state.indexOf("site:");
      let search = state;
      if (index !== -1) {
        let end = index + "site:".length;
        for (; end < search.length; end++) {
          if (search[end] === " " || search[end] === "\t") {
            break;
          }
        }
        search = (state.slice(0, index) + state.slice(end)).trim();
      }
      return search + " site:" + action.site;
    }
    default:
      return state;
  }
}

/**
 * @param {HistoryPlus.HistoryRow[]} state
 * @param {HistoryPlus.Action} action
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
