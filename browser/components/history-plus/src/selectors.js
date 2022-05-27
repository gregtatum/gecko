/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

/**
 * @param {HistoryPlus.State} state
 */
export function getSearchString(state) {
  return state.searchString;
}

/**
 * @param {HistoryPlus.State} state
 */
export function getHistoryRows(state) {
  return state.historyRows;
}
