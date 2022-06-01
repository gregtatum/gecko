/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

const { PlacesUtils } = ChromeUtils.import(
  "resource://gre/modules/PlacesUtils.jsm"
);

/**
 * @param {string} host
 */
async function getMostRecentByHost(host) {
  const db = await PlacesUtils.promiseDBConnection();
  const rows = await db.execute(
    `
    SELECT *
    FROM moz_places
    WHERE
      rev_host = :revHost
    ORDER BY
      last_visit_date DESC
    LIMIT 100
  `,
    { revHost: PlacesUtils.getReversedHost({ host }) }
  );

  console.log(
    `!!! `,
    rows.map(row => ({
      url: row.getResultByName("url"),
      title: row.getResultByName("title"),
      row,
    }))
  );
}
