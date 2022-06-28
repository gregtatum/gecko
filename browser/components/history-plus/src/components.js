/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check

/**
 * @template P
 * @typedef {import("react-redux").ResolveThunks<P>} ResolveThunks<P>
 */

import { React, ReactDOMFactories } from "./vendor.js";
const { a, div, h1, input, img, b } = ReactDOMFactories;
import { sql } from "./utils.js";

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
  parsedSearch.search = parsedSearch.search.trim();
  return parsedSearch;
}

/**
 * @typedef {Awaited<
 *  ReturnType<(typeof PlacesUtils)["promiseDBConnection"]>
 * >} Database
 */

/** @type {Console} */
// @ts-ignore
const console = window.console.createInstance({
  maxLogLevelPref: "browser.contentCache.logLevel",
  prefix: "history-plus db",
});

/**
 * @param {string} searchString
 * @returns {Promise<HistoryRow[]>}
 */
export async function searchHistory(searchString) {
  const { search, host } = parseSearch(searchString);
  const db = await PlacesUtils.promiseDBConnection();
  let rows;
  let revHost = sql``;

  /** @type {{ search: string, revHost?: string }} */
  const args = { search };

  if (!search) {
    if (host) {
      console.log("Searching for only a host", host);
      const statement = sql`
        SELECT *
        FROM moz_places
        WHERE
          rev_host LIKE :revHost
        ORDER BY
          last_visit_date DESC
        LIMIT 100
      `;
      rows = await statement.run(db, {
        revHost: `%${PlacesUtils.getReversedHost({ host })}%`,
      });
    } else {
      console.log("Searching all recent history", host);
      const statement = sql`
        SELECT *
        FROM moz_places
        ORDER BY
          last_visit_date DESC
        LIMIT 100
      `;
      rows = await statement.run(db);
    }
  } else {
    if (host) {
      console.log("Searching a host and text", host, search);
      args.revHost = `%${PlacesUtils.getReversedHost({ host })}%`;
      revHost = sql`
        AND moz_places.rev_host LIKE :revHost
      `;
    } else {
      console.log("Searching text", search);
    }
    const statement = sql`
      SELECT
        moz_contentcache_text.text as text,
        moz_places.url             as url,
        moz_places.title           as title,
        snippet(
          moz_contentcache_text,
          0,    -- Zero-indexed column
          '<b>',   -- Insert before text match
          '</b>',   -- Insert after text match
          '',   -- The text to add to the start or end of the selected text to indicate
                -- that the returned text does not occur at the start or end of its
                -- column, respectively.
          40    -- 0-64 The maximum number of tokens in the returned text.
        ) as description
      FROM moz_contentcache_text
      LEFT JOIN moz_places
      ON moz_contentcache_text.rowid = moz_places.id
      WHERE moz_contentcache_text MATCH :search
        ${revHost}
      ORDER BY  rank
      LIMIT     100
    `;
    console.time("moz_contentcache_text");
    rows = await statement.run(db, args);
    console.timeEnd("moz_contentcache_text");
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

  React.useEffect(() => {
    searchHistory("").then(
      rows => setRows(rows),
      error => console.error(error)
    );
  }, []);

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
        defaultValue: "",
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
        div(
          { className: "historyResultsUrl" },
          img({ src: "page-icon:" + url, className: "historyResultsFavicon" }),
          DisplayURL(url)
        ),
        a(
          { className: "historyResultsTitle", href: url, target: "_blank" },
          title || url
        ),
        div(
          { className: "historyResultsDescription" },
          ApplyBoldTags({ text: description })
        )
      )
    )
  );
}

/**
 * @param {string} url
 */
function DisplayURL(url) {
  return url.replace(/^https?:\/\//, "");
}

/**
 * @param {Object} props
 * @param {string} [props.text]
 */
function ApplyBoldTags({ text }) {
  if (!text) {
    return null;
  }
  const parts = [];
  const chunks = text.split("<b>");
  parts.push(chunks[0]);
  for (const chunk of chunks.slice(1)) {
    const [innerText, ...rest] = chunk.split("</b>");
    parts.push(b(null, innerText), ...rest);
  }
  return parts;
}
