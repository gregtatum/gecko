/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * @ts-check */

import { reselect } from "./vendor.js";

/** @type {HistoryPlus.Selector<XPCOM.nsINavHistoryContainerResultNode[]>} */
export const getHistory = state => state.history;

/** @type {HistoryPlus.Selector<string[]>} */
export const topFrecencyDomains = reselect.createSelector(
  getHistory,
  history => {
    const set = new Set();
    const domains = [];
    for (const historyNode of history) {
      const { hostname } = new URL(historyNode.uri);
      if (!set.has(hostname)) {
        set.add(hostname);
        domains.push(hostname);
      }
    }
    return domains;
  }
);
