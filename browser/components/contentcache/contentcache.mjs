/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { sql, console, applyBoldTags, noop } from "./utils.mjs";

const lazy = {};

ChromeUtils.defineESModuleGetters(lazy, {
  PlacesUtils: "resource://gre/modules/PlacesUtils.sys.mjs",
});

document.addEventListener("DOMContentLoaded", () => {
  const state = new ContentCacheState();
  const view = new ContentCacheView(state);
  state.onChangeHistoryRows = view.updateRows.bind(view);
  state.onChangeSearchString = view.updateSearchString.bind(view);

  // Aid in the debugging by making these globally accessible.
  window.state = state;
  window.view = view;
});

class ContentCacheState {
  /**
   * The current search string in the input.
   * @type {string | null}
   */
  searchString = null;

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
  historyRows = [];

  /**
   * Let the view know when the history rows have been changed.
   * @type {() => {}}
   */
  onChangeHistoryRows = null;

  /**
   * Let the view know when the search string has been changed.
   * @type {() => {}}
   */
  onChangeSearchString = null;

  /**
   * Performs the actual search against the content cache.
   * @param {string} searchString
   */
  async searchHistory(searchString) {
    this.searchString = searchString;
    if (this.onChangeSearchString) {
      this.onChangeSearchString();
    }
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
    if (this.onChangeHistoryRows) {
      this.onChangeHistoryRows();
    }
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

  /**
   * @param {string} site
   */
  async addSiteToSearchString(site) {
    const oldSearch = this.searchString;
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
    return this.searchHistory((search + " site:" + site).trim() + " ");
  }
}

class ContentCacheView {
  constructor(state) {
    /** @type {ContentCacheState} */
    this.state = state;
    this.searchInput = document.getElementById("searchInput");
    this.resultsContainer = document.getElementById("resultsContainer");
    this.resultRow = document.querySelector(".contentCacheResultsRow");
    this.moreOptions = document.querySelector(".contentCacheMoreOptionsMenu");

    // These will be cloned for insertion when needed.
    this.resultRow.remove();
    this.moreOptions.remove();

    this.updateRows();
    this.initializeSearch();
    this.addListeners();

    this.resultsContainer.style.display = "block";
  }

  initializeSearch() {
    const { value } = this.searchInput;
    if (value === this.state.searchString) {
      return;
    }
    this.state.searchHistory(value);
  }

  addListeners() {
    this.searchInput.addEventListener("input", () => {
      const { value } = this.searchInput;
      if (value === this.state.searchString) {
        return;
      }
      this.state.searchHistory(value);
    });
  }

  updateSearchString() {
    this.searchInput.value = this.state.searchString;
  }

  updateRows() {
    const fragment = document.createDocumentFragment();

    // Build the results rows.
    for (const { description, title, url } of this.state.historyRows) {
      const rowEl = this.resultRow.cloneNode(true /* deep */);
      const linkEl = rowEl.querySelector(".contentCacheResultsTitle");
      linkEl.innerText = title || url;
      linkEl.setAttribute("href", url);
      rowEl.querySelector("img").setAttribute("src", "page-icon:" + url);

      applyBoldTags(
        rowEl.querySelector(".contentCacheResultsDescription"),
        description
      );
      this.buildDisplayURL(
        rowEl.querySelector(".contentCacheResultsUrlRow"),
        url
      );

      rowEl
        .querySelector(".contentCacheMoreOptions")
        .addEventListener("click", this.showMoreOptions);

      fragment.appendChild(rowEl);
    }

    while (this.resultsContainer.firstChild) {
      this.resultsContainer.firstChild.remove();
    }
    this.resultsContainer.appendChild(fragment);
  }

  /**
   * @param {HTMLSpanElement} span
   * @param {string} rawURL
   */
  buildDisplayURL(span, rawURL) {
    let url;
    try {
      url = new URL(rawURL);
    } catch (error) {
      span.textContent = rawURL;
      return;
    }
    const { host } = url;
    const index = rawURL.indexOf(host) + 1 + host.length;
    //                                   ^ skip the first "/" in the url
    if (index === -1) {
      span.textContent = rawURL;
      return;
    }
    const button = document.createElement("button");
    button.className = "contentCacheResultsUrlHost";
    button.textContent = url.host;
    button.dataset.host = url.host;
    button.addEventListener("click", this.onHostClick);

    span.appendChild(button);

    // Build the display for the following part of the URL:
    // example.com/path/slug/?param
    //            ^^^^^^^^^^^^^^^^^
    const urlRest = rawURL.slice(index);
    if (urlRest.length) {
      const s1 = document.createElement("span");
      s1.className = "contentCacheResultsUrlSlash";
      s1.textContent = "/";

      const s2 = document.createElement("span");
      s2.className = "contentCacheResultsUrlRow";
      s2.textContent = urlRest;

      span.appendChild(s1);
      span.appendChild(s2);
    }
  }

  /**
   * @param {MouseEvent} event
   */
  onHostClick = event => {
    this.state.addSiteToSearchString(event.target.dataset.host);
  };

  /** @type {HTMLElement | null} */
  moreOptionsButton = null;

  /** @type {() => void} */
  removeMoreOptions = noop;

  /**
   * @param {MouseEvent} event
   */
  showMoreOptions = event => {
    if (event.target === this.moreOptionsButton) {
      // Toggling this button off.
      this.removeMoreOptions();
      return;
    }

    if (this.moreOptionsButton?.contains(event.target)) {
      // Ignore this click since it's clicking inside of the dropdown.
      return;
    }

    const moreOptions = this.moreOptions.cloneNode(true /* deep */);

    this.moreOptionsButton = event.target;
    this.moreOptionsButton.removeEventListener("click", this.showMoreOptions);

    this.removeMoreOptions = () => {
      moreOptions.remove();
      document.body.removeEventListener("click", bodyClick, true);
      document.body.removeEventListener("keypress", escapeListener, true);
      this.moreOptionsButton.addEventListener("click", this.showMoreOptions);
      this.moreOptionsButton = null;
      this.removeMoreOptions = noop;
    };

    const bodyClick = ({ target }) => {
      if (moreOptions.contains(target)) {
        return;
      }
      this.removeMoreOptions();
    };

    const escapeListener = ({ key }) => {
      if (key === "Escape") {
        this.removeMoreOptions();
      }
    };

    document.body.addEventListener("click", bodyClick, true /* use capture */);
    document.body.addEventListener(
      "keypress",
      escapeListener,
      true /* use capture */
    );
    this.moreOptionsButton.parentNode.appendChild(moreOptions);
  };
}
