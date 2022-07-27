/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const lazy = {};

/**
 * We use the UrlbarTokenizer and UrlbarUtils to get similar highlighting
 * behaviour for the History result titles when there is a search query
 * string to match against.
 */
XPCOMUtils.defineLazyModuleGetters(lazy, {
  UrlbarTokenizer: "resource:///modules/UrlbarTokenizer.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
});

import { timeSince } from "./time-since.js";

window.gHistorySearch = {
  init() {
    window.addEventListener("History:SetQuery", this);
  },

  handleEvent(event) {
    switch (event.type) {
      case "History:SetQuery": {
        this.doQuery(event.detail.queryString);
        break;
      }
      case "click": {
        this.closeViewer();
        break;
      }
    }
  },
  /**
   * Makes a History query request to the parent process for a given
   * query string, and then displays the results using the
   * HistoryViewer element in the document.
   *
   * @param {String} queryString
   *   The string to do a query for. A false-y value or a string that
   *   trims to the empty string requests all recent history.
   * @param {boolean} [fromNavigationBar=false]
   *   True if the query is the result of a handoff from the navigation
   *   bar.
   * @returns Promise
   * @resolves undefined
   *   Resolves once the results have been displayed.
   */
  async doQuery(queryString, fromNavigationBar = false) {
    let companionTabs = document.querySelector(".tab-button-group");
    companionTabs.toggleAttribute("history-visible", true);

    let { results, limit, total } = await window.CompanionUtils.sendQuery(
      "Companion:BeginHistorySearch",
      {
        query: { input: queryString },
      }
    );

    let viewer = document.getElementById("history-viewer");
    viewer.showResults(results, queryString, limit, total, fromNavigationBar);

    let e = new CustomEvent("Companion:HistoryResultsUpdated", {
      bubbles: true,
      cancelable: false,
    });
    window.dispatchEvent(e);

    if (!this.closeButton) {
      this.closeButton = document.querySelector(".history-section-close");
      this.closeButton.addEventListener("click", this);
    }
  },

  closeViewer() {
    let companionTabs = document.querySelector(".tab-button-group");
    companionTabs.toggleAttribute("history-visible", false);

    document.getElementById("companion-deck").selectedViewName = "browse";
  },
};

window.gHistorySearch.init();

/**
 * @typedef {Object} HistoryResult
 *   A single history result returned from the parent process for a history
 *   search query.
 * @property {String} title
 *   The title of the history result.
 * @property {String} url
 *   The URL of the history result.
 * @property {Date} lastVisitDate
 *   The date of the last visit to this URL.
 */

/**
 * HistoryViewerEl is responsible for displaying the results of a history
 * search query. This includes metadata about the query, like how many
 * results were returned and how many total results there would be were
 * there no limit to the search.
 */
export class HistoryViewerEl extends HTMLElement {
  /** @type {IntersectionObserver|null} */
  #observer = null;

  constructor() {
    super();
    let shadowRoot = this.attachShadow({ mode: "open" });
    let template = document.getElementById("template-history-viewer");
    let fragment = template.content.cloneNode(true);
    document.l10n.connectRoot(this.shadowRoot);
    shadowRoot.appendChild(fragment);
    this.addEventListener("click", this);

    let searchInput = shadowRoot.querySelector(".history-search-input");
    searchInput.addEventListener("command", this);

    let fn = this.onFirstListItemIntersection.bind(this);
    this.#observer = new IntersectionObserver(fn, {
      root: null,
      rootMargin: "0px",
      threshold: [HistoryViewerEl.INTERSECTION_THRESHOLD],
    });
  }

  /**
   * Called by the HistoryViewerEl IntersectionObserver when the first
   * or last <li> in the list gets scrolled out by at least 5%.
   *
   * @param {IntersectionObserverEntry[]}
   */
  onFirstListItemIntersection(entries) {
    let separator = this.shadowRoot.querySelector(".separator");
    let resultList = this.shadowRoot.querySelector(".history-result-list");
    for (let entry of entries) {
      if (entry.target == resultList.firstElementChild) {
        separator.toggleAttribute(
          "invisible",
          entry.isIntersecting &&
            entry.intersectionRatio >= HistoryViewerEl.INTERSECTION_THRESHOLD
        );
      }
      if (entry.target == resultList.lastElementChild) {
        resultList.toggleAttribute("show-fade", !entry.isIntersecting);
      }
    }
  }

  handleEvent(event) {
    switch (event.type) {
      case "command": {
        let e = new CustomEvent("History:SetQuery", {
          bubbles: true,
          composed: true,
          detail: { queryString: event.target.value },
        });
        this.dispatchEvent(e);
        break;
      }
      case "click": {
        let node = event.composedTarget;
        let host = node.getRootNode().host;
        if (host instanceof HistoryResultEl) {
          let url = host.getAttribute("url");
          window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", { url });
        }
        break;
      }
    }
  }

  /**
   * Shows the results of a history search query.
   *
   * @param {HistoryResult[]} results
   *   The array of HistoryResults returned by the parent process. It is
   *   assumed that this list has been pre-sorted by the lastVisitDate of
   *   the HistoryResults, descending.
   * @param {String} queryString
   *   The original query string associated with these search results.
   * @param {Number} limit
   *   The maximum number of results that the parent is configured to
   *   send.
   * @param {Number} total
   *   The total number of results that exist in the database, without
   *   the limit applied.
   * @param {boolean} fromNavigationBar
   *   True if the results are for a query initiated by a handoff from the
   *   navigation bar.
   */
  showResults(results, queryString, limit, total, fromNavigationBar) {
    this.#observer.disconnect();

    if (fromNavigationBar) {
      let searchInput = this.shadowRoot.querySelector(".history-search-input");
      searchInput.value = queryString;
    }

    let totalBeforeLimit = this.shadowRoot.querySelector(".total-before-limit");
    document.l10n.setAttributes(
      totalBeforeLimit,
      "history-results-total-before-limit",
      {
        totalBeforeLimit: total,
      }
    );
    let trimmedQuery = queryString.trim();
    let emptyQuery = trimmedQuery == "";
    totalBeforeLimit.toggleAttribute("empty-query", emptyQuery);

    let queryContext = {
      searchString: queryString,
      trimmedSearchString: trimmedQuery,
    };
    let queryTokens = lazy.UrlbarTokenizer.tokenize(queryContext).tokens;

    let resultList = this.shadowRoot.querySelector(".history-result-list");
    let frag = document.createDocumentFragment();
    for (let result of results) {
      let li = document.createElement("li");
      let highlightedTitleRanges = [];

      if (!emptyQuery) {
        highlightedTitleRanges = lazy.UrlbarUtils.getTokenMatches(
          queryTokens,
          result.title || result.url,
          lazy.UrlbarUtils.HIGHLIGHT.TYPED
        );
      }
      li.appendChild(new HistoryResultEl(result, highlightedTitleRanges));
      frag.appendChild(li);
    }

    resultList.replaceChildren(frag);

    if (total > limit) {
      let template = document.getElementById("template-history-viewer-footer");
      let footer = template.content.cloneNode(true);
      let footerLi = document.createElement("li");
      footerLi.classList.add("footer");
      footerLi.appendChild(footer);
      resultList.appendChild(footerLi);

      let limitOutOfTotal = this.shadowRoot.querySelector(
        ".limit-out-of-total"
      );
      limitOutOfTotal.dataset.l10nArgs = JSON.stringify({
        total: results.length,
        totalBeforeLimit: total,
      });
    }

    if (resultList.firstElementChild) {
      this.#observer.observe(resultList.firstElementChild);
      this.#observer.observe(resultList.lastElementChild);
    }
  }

  /**
   * The intersection threshold that the first list item must cross
   * before the separator above the list becomes invisible.
   */
  static get INTERSECTION_THRESHOLD() {
    return 0.95;
  }
}

export class HistoryResultEl extends HTMLElement {
  /**
   * HistoryResultEl constructor.
   *
   * @param {HistoryResult} result
   *   The result to represent with this HistoryResultEl.
   */
  constructor(result, highlightedTitleRanges) {
    super();
    this.setAttribute("url", result.url);

    let shadowRoot = this.attachShadow({ mode: "open" });
    document.l10n.connectRoot(this.shadowRoot);

    let template = document.getElementById("template-history-result");
    let fragment = template.content.cloneNode(true);
    let titleOrURLString = result.title || result.url;

    let button = fragment.querySelector(".history-result-button");
    button.setAttribute("url", result.url);
    button.title = titleOrURLString;

    let title = fragment.querySelector(".history-result-title");
    let url = fragment.querySelector(".history-result-url");

    if (highlightedTitleRanges.length) {
      // This is an almost verbatim copy of the same logic that's used to render
      // highlights within UrlbarResult rows, written here:
      // https://searchfox.org/mozilla-central/rev/70504e4c6fe61c027675c792d328ee476b6b1c1f/browser/components/urlbar/UrlbarView.jsm#2193-2229
      //
      // That logic is within a pseudo-private method, so for safety we reimplement
      // the logic here.
      let index = 0;
      highlightedTitleRanges = highlightedTitleRanges.concat([
        [titleOrURLString.length, 0],
      ]);
      for (let [highlightIndex, highlightLength] of highlightedTitleRanges) {
        if (highlightIndex - index > 0) {
          title.appendChild(
            document.createTextNode(
              titleOrURLString.substring(index, highlightIndex)
            )
          );
        }
        if (highlightLength > 0) {
          let strong = document.createElement("strong");
          strong.textContent = titleOrURLString.substring(
            highlightIndex,
            highlightIndex + highlightLength
          );
          title.appendChild(strong);
        }
        index = highlightIndex + highlightLength;
      }
    } else {
      title.textContent = titleOrURLString;
    }
    title.title = titleOrURLString;
    url.textContent = result.url;
    url.title = result.url;

    let lastVisited = fragment.querySelector(".history-result-last-visited");
    lastVisited.textContent = timeSince(result.lastVisitDate);

    let icon = fragment.querySelector(".history-result-icon");
    icon.setAttribute("src", `page-icon:${result.url}`);

    shadowRoot.appendChild(fragment);
  }
}

customElements.define("e-history-viewer", HistoryViewerEl);
customElements.define("e-history-result", HistoryResultEl);
