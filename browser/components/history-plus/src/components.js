/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

/**
 * @template P
 * @typedef {import("react-redux").ResolveThunks<P>} ResolveThunks<P>
 */

import { React, ReactDOMFactories, ReactRedux } from "./vendor.js";
import * as selectors from "./selectors.js";
const { a, div, h1, input, img } = ReactDOMFactories;

const { PlacesUtils } = ChromeUtils.import(
  "resource://gre/modules/PlacesUtils.jsm"
);

/**
 * @typedef {{
 *   url: string,
 *   title: string,
 *   description: string,
 *   row: any,
 * }} HistoryRow
 */

/**
 * @param {string} host
 * @returns {Promise<HistoryRow[]>}
 */
export async function searchHistory(host) {
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

  return rows.map(row => ({
    url: row.getResultByName("url"),
    title: row.getResultByName("title"),
    description: row.getResultByName("description"),
    row,
  }));
}

/** @type {HistoryRow[]} */
const emptyRows = [];

export function HistoryPlus() {
  const [rows, setRows] = React.useState(emptyRows);
  return div(
    { className: `history` },
    h1(null, "History"),
    div(
      {
        className: "historyInputWrapper",
      },
      img({
        src: "chrome://global/skin/icons/search-textbox.svg",
        className: "historyInputIcon",
      }),
      input({
        type: "text",
        className: "historyInput",
        placeholder: "Seach all history",
        onChange: async event => {
          setRows(await searchHistory(event.target.value));
        },
      }),
      HistoryResults({ rows })
    )
  );
}

/**
 * @param {{ rows: HistoryRow[] }} props
 */
function HistoryResults(props) {
  const { rows } = props;
  return div(
    { className: "historyResults" },
    rows.map(({ url, title, description }) =>
      div(
        { className: "historyResultsRow" },
        div({ className: "historyResultsUrl" }, url),
        a(
          { className: "historyResultsTitle", href: url, target: "_blank" },
          title || url
        ),
        div({ className: "historyResultsDescription" }, description)
      )
    )
  );
}
