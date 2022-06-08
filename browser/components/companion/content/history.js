/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { timeSince } from "./time-since.js";

window.gHistorySearch = {
  /**
   * Makes a History query request to the parent process for a given
   * query string, and then displays the results using the
   * HistoryViewer element in the document.
   *
   * @param {String} queryString
   *   The string to do a query for. A false-y value or a string that
   *   trims to the empty string requests all recent history.
   * @returns Promise
   * @resolves undefined
   *   Resolves once the results have been displayed.
   */
  async doQuery(queryString) {
    let { results, limit } = await window.CompanionUtils.sendQuery(
      "Companion:BeginHistorySearch",
      {
        query: { input: queryString },
      }
    );

    let viewer = document.getElementById("history-viewer");
    viewer.showResults(results, queryString, limit);
  },
};

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
  constructor() {
    super();
    let template = document.getElementById("template-history-viewer");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);
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
   */
  showResults(results, queryString, limit) {
    let query = this.querySelector(".query");
    query.hidden = !queryString.trim();
    query.textContent = queryString;
    let totalBeforeLimit = this.querySelector(".total-before-limit");

    // MR2-2604 - We don't currently know how many results we could have
    // gotten before limiting. For now, just show the total number of
    // results after limiting.
    totalBeforeLimit.dataset.l10nArgs = JSON.stringify({
      totalBeforeLimit: results.length,
    });

    let resultList = this.querySelector(".history-result-list");
    let frag = document.createDocumentFragment();
    for (let result of results) {
      frag.appendChild(new HistoryResultEl(result));
    }
    resultList.replaceChildren(frag);
  }
}

export class HistoryResultEl extends HTMLLIElement {
  /**
   * HistoryResultEl constructor.
   *
   * @param {HistoryResult} result
   *   The result to represent with this HistoryResultEl.
   */
  constructor(result) {
    super();
    let template = document.getElementById("template-history-result");
    let fragment = template.content.cloneNode(true);

    let title = fragment.querySelector(".history-result-title");
    let url = fragment.querySelector(".history-result-url");
    title.textContent = result.title;
    url.textContent = result.url;
    let lastVisited = fragment.querySelector(".history-result-last-visited");
    lastVisited.textContent = timeSince(result.lastVisitDate);

    this.appendChild(fragment);
  }
}

customElements.define("e-history-viewer", HistoryViewerEl);
customElements.define("e-history-result", HistoryResultEl, { extends: "li" });
