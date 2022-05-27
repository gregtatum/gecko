/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * @ts-check
 */

/**
 * Receive the values to initialize the store. See the reducer for what values
 * are expected.
 * @param {HistoryPlus.InitializeStoreValues} values
 * @return {HistoryPlus.Action}
 */
export function initializeStore(values) {
  return {
    type: "INITIALIZE_STORE",
    ...values,
  };
}
