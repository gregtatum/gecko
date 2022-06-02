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
 * @typedef {{
 *   host?: string,
 *   search: string,
 * }} ParsedSearch
 */

/**
 * @param {string} search
 * @returns {ParsedSearch}
 */
function parseSearch(search) {
  /** @type {ParsedSearch} */
  const parsedSearch = { search: "" };
  const regex = /^site:(.*)$/;

  for (const part of search.split(" ")) {
    const siteResult = regex.exec(part.trim());
    if (siteResult) {
      parsedSearch.host = siteResult[1];
    } else {
      if (parsedSearch.search.length !== 0) {
        parsedSearch.search += " ";
      }
      parsedSearch.search += part;
    }
  }
  return parsedSearch;
}

/**
 * @typedef {Awaited<
 *  ReturnType<(typeof PlacesUtils)["promiseDBConnection"]>
 * >} Database
 */

/**
 * @param {Database} db
 * @param {string} query
 * @param {Record<string, string>} args
 * @returns {ReturnType<Database["execute"]>}
 * (sql: string, params?: Record<string, string> | null, onRow?: any | null): Promise<Row[]>;
 */
function dbExecute(db, query, args) {
  console.log("[db] execute", { query: { query }, args });
  return db.execute(query, args);
}

/**
 * @param {string} searchString
 * @returns {Promise<HistoryRow[]>}
 */
export async function searchHistory(searchString) {
  const { search, host } = parseSearch(searchString);
  const db = await PlacesUtils.promiseDBConnection();
  let rows;
  if (host) {
    if (search.trim()) {
      rows = await dbExecute(
        db,
        /* sql */ `
          SELECT *
          FROM moz_places
          WHERE
            rev_host LIKE :revHost AND
            (
              title LIKE :search OR
              description LIKE :search
            )

          ORDER BY
            last_visit_date DESC
          LIMIT 100
        `,
        {
          search: `%${search}%`,
          revHost: `%${PlacesUtils.getReversedHost({ host })}%`,
        }
      );
    } else {
      rows = await dbExecute(
        db,
        /* sql */ `
          SELECT *
          FROM moz_places
          WHERE
            rev_host LIKE :revHost
          ORDER BY
            last_visit_date DESC
          LIMIT 100
        `,
        {
          revHost: `%${PlacesUtils.getReversedHost({ host })}%`,
        }
      );
    }
  } else {
    rows = await dbExecute(
      db,
      /* sql */ `
        SELECT *
        FROM moz_places
        WHERE
          title LIKE :search OR
          description LIKE :search
        ORDER BY
          last_visit_date DESC
        LIMIT 100
      `,
      { search: `%${search}%` }
    );
  }

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
        onChange: event => {
          searchHistory(event.target.value).then(
            rows => setRows(rows),
            error => console.error(error)
          );
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
