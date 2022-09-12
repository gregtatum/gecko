/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { sql, console } from "./contentcache/utils.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

document.addEventListener("DOMContentLoaded", () => {
  const state = new ContentCacheState();
  new ContentCacheView(state);
});

class ContentCacheState {
  /**
   * The current search string in the input.
   * @type {string | null}
   */
  searchString = null

  /**
   * The current results for the search.
   *
   * @type {{
   *  description: string,
   *  row: string,
   *  title: string,
   *  url: string
   * }}
   */
  historyRows = []

  /**
   * Let the view know when the history rows have been changed.
   * @type {() => {}}
   */
  onChangeHistoryRows = null;

  async searchHistory(searchString) {
    this.searchString = searchString;
    const { search, host } = ContentCacheState.parseSearch(searchString);
    const db = await lazy.PlacesUtils.promiseDBConnection();
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
          revHost: `%${lazy.PlacesUtils.getReversedHost({ host })}%`,
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
        args.revHost = `%${lazy.PlacesUtils.getReversedHost({ host })}%`;
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

    this.historyRows = rows.map(row => ({
      url: row.getResultByName("url"),
      title: row.getResultByName("title"),
      description: row.getResultByName("description"),
      row,
    }));
    this.onChangeHistoryRows();
  }

  /**
   * @param {string} search
   * @returns {{
   *   host?: string,
   *   search: string,
   * }}
   */
  static parseSearch(search) {
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

}

class ContentCacheView {
  constructor(state) {
    /** @type {ContentCacheState} */
    this.state = state;
    state.onChangeHistoryRows = () => {
      this.updateRows();
    }
    window.view = this;
    this.searchInput = document.getElementById("searchInput");
    this.resultsContainer = document.getElementById("resultsContainer");
    this.resultRow = document.querySelector(".contentCacheResultsRow");

    this.resultRow.remove();

    this.updateRows();
    this.updateSearch();
    this.resultsContainer.style.display = "block"

    this.resultRow.remove();

    this.searchInput.addEventListener("input", this.updateSearch.bind(this));
  }

  updateSearch() {
    const { value } = this.searchInput;
    if (value === this.state.searchString) {
      return;
    }
    this.state.searchHistory(value);
  }

  prevRows = null;

  updateRows() {
    const { historyRows } = this.state
    // Only update if the results have changed.
    if (historyRows === this.prevRows) {
      return;
    }
    this.prevRows = historyRows;

    const fragment = document.createDocumentFragment();

    // Build the results rows.
    for (const { description, row, title, url } of historyRows) {
      const rowEl = this.resultRow.cloneNode(true /* deep */);
      rowEl.querySelector("img").setAttribute("src", "page-icon:" + url);
      const linkEl = rowEl.querySelector(".contentCacheResultsTitle");
      linkEl.innerText = title || url
      linkEl.setAttribute("href", url);

      applyBoldTags(rowEl.querySelector(".contentCacheResultsDescription"), description);
      rowEl.querySelector(".contentCacheResultsUrl").appendChild(buildDisplayURL(url));

      fragment.appendChild(rowEl);
    }

    while(this.resultsContainer.firstChild) {
      this.resultsContainer.removeChild(this.resultsContainer.firstChild);
    }
    this.resultsContainer.appendChild(fragment);
  }
}

/**
 * @param {string} rawURL
 * @returns {HTMLElement}
 */
function buildDisplayURL(rawURL) {
  let url;
  try {
    url = new URL(rawURL);
  } catch (error) {
    return rawURL;
  }
  const { host } = url;
  const index = rawURL.indexOf(host) + 1 + host.length;
  //                                   ^ skip the first "/"
  if (index === -1) {
    return document.createTextNode(rawURL);
  }
  const span = document.createElement("span");
  span.className = "contentCacheResultsUrlRow";

  const button = document.createElement("button");
  button.className="contentCacheResultsUrlHost";
  button.textContent = url.host;
  span.appendChild(button);

  // Build the display for the following part of the URL:
  // example.com/path/slug/?param
  //            ^^^^^^^^^^^^^^^^^
  const urlRest = rawURL.slice(index);
  if (urlRest.length) {
    const s1 = document.createElement("span");
    s1.className = "contentCacheResultsUrlRow";
    s1.textContent = "/";

    const s2 = document.createElement("span");
    s2.className = "contentCacheResultsUrlRow";
    s2.textContent = urlRest;

    span.appendChild(s1);
    span.appendChild(s2);
  }

  return span;
}

function buildMoreOptions() {
  const { isOpen, setIsOpen } = useOpenCloseBehavior();

  let menu = null;
  if (isOpen) {
    menu = div(
      { className: "contentCacheMoreOptionsMenu" },
      button({ className: "contentCacheHostMenuItem" }, "Forget this page"),
      button({ className: "contentCacheHostMenuItem" }, "Forget this site"),
      button({ className: "contentCacheHostMenuItem" }, "Add as bookmark")
    );
  }

  return button(
    { className: "contentCacheMoreOptions", onClick: () => setIsOpen(true) },
    span(
      // TODO - Do not use a random unicode glyph here.
      {
        style: {
          fontSize: "20px",
          position: "relative",
          display: "inline-block",
          left: "-2px",
        },
      },
      "⠸"
    ),
    menu
  );
}


/**
 * Converts <b> and </b> text in a string into bold tags.
 *
 * @param {HTMLElement} container
 * @param {string} text
 */
function applyBoldTags(container, text) {
  if (!text) {
    return null;
  }
  const parts = [];
  const [firstChunk, ...chunks] = text.split("<b>");

  // The first chunk will always not be a bold tag. If the text starts with <b>
  // then the first chunk will be "".
  container.appendChild(document.createTextNode(firstChunk))

  for (const chunk of chunks) {
    const [boldText, ...normalTexts] = chunk.split("</b>");
    {
      // Add the bold tag.
      const b = document.createElement('b')
      b.textContent = boldText;
      container.appendChild(b);
    }

    // Add any of the rest of the non-bold text. The only reason this is a for loop
    // is to handle when there are incorrectly nested </b> tags.
    for (const normalText of normalTexts) {
      container.appendChild(document.createTextNode(normalText))
    }
  }

  return parts;
}
