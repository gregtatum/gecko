/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

window.gHistorySearch = {
  async doQuery(queryString) {
    let { results, limit } = await window.CompanionUtils.sendQuery(
      "Companion:BeginHistorySearch",
      {
        query: { input: queryString },
      }
    );

    console.log(limit, results);
  },
};
