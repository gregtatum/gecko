/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// @ts-check
import * as Selectors from "../selectors.js";
import { sql, console } from "../utils.js";

const { PlacesUtils } = ChromeUtils.import(
  "resource://gre/modules/PlacesUtils.jsm"
);

/**
 * These should only be used internally in thunks.
 */
export const PlainInternal = {
  /**
   * @param {string} search
   */
  setSearchString(search) {
    return {
      type: /** @type {const} */ ("set-search-string"),
      search,
    };
  },

  /**
   * @param {HistoryPlus.HistoryRow[]} rows
   */
  setHistoryRows(rows) {
    return {
      type: /** @type {const} */ ("set-history-rows"),
      rows,
    };
  },
};

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
 * @param {string} searchString
 * @returns {HistoryPlus.Thunk<Promise<HistoryPlus.HistoryRow[]>>}
 */
export function searchHistory(searchString) {
  return async (dispatch, getState) => {
    dispatch(PlainInternal.setSearchString(searchString));
    const { search, host } = parseSearch(searchString);
    const db = await PlacesUtils.promiseDBConnection();
    let rows;
    let revHost = sql``;

    /** @type {{ search: string, revHost?: string }} */
    const args = { search };

    if (!search) {
      if (host) {
        console.log("[db] Searching for only a host", host);
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
        console.log("[db] Searching all recent history");
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
        console.log("[db] Searching a host and text", host, search);
        args.revHost = `%${PlacesUtils.getReversedHost({ host })}%`;
        revHost = sql`
        AND moz_places.rev_host LIKE :revHost
      `;
      } else {
        console.log("[db] Searching text", search);
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
      const now = performance.now();
      rows = await statement.run(db, args);
      console.log(
        "[db] statement took ",
        Math.round((performance.now() - now) * 100) / 100 + "ms"
      );
    }

    const historyRows = rows.map(row => ({
      url: row.getResultByName("url"),
      title: row.getResultByName("title"),
      description: row.getResultByName("description"),
      row,
    }));

    dispatch(PlainInternal.setHistoryRows(historyRows));
    return historyRows;
  };
}

/**
 * @param {string} site
 * @returns {HistoryPlus.Thunk<Promise<HistoryPlus.HistoryRow[]>>}
 */
export function addSiteToSearchString(site) {
  return async (dispatch, getState) => {
    const oldSearch = Selectors.getSearchString(getState());
    const index = oldSearch.indexOf("site:");
    let search = oldSearch;
    if (index !== -1) {
      let end = index + "site:".length;
      for (; end < search.length; end++) {
        if (search[end] === " " || search[end] === "\t") {
          break;
        }
      }
      search = (oldSearch.slice(0, index) + oldSearch.slice(end)).trim();
    }
    return dispatch(searchHistory((search + " site:" + site).trim() + " "));
  };
}
