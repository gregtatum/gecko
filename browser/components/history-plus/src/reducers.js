/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * @ts-check */

import { Redux } from "./vendor.js";

/**
 * The current state of the recording.
 * @type {HistoryPlus.Reducer<HistoryPlus.HistoryItem[]>}
 */
function history(state = [], action) {
  switch (action.type) {
    case "INITIALIZE_STORE":
      return action.history;
    default:
      return state;
  }
}

/**
 * @type {HistoryPlus.Reducer<HistoryPlus.State>}
 */
export const reducers = Redux.combineReducers({ history });
