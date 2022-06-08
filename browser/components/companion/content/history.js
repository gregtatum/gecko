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
      } else {
        resultList.toggleAttribute("show-fade", !entry.isIntersecting);
      }
    }
  }

  handleEvent(event) {
    let node = event.composedTarget;
    let host = node.getRootNode().host;
    if (host instanceof HistoryResultEl) {
      let url = host.getAttribute("url");
      window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", { url });
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
   */
  showResults(results, queryString, limit) {
    this.#observer.disconnect();

    let query = this.shadowRoot.querySelector(".query");
    query.hidden = !queryString.trim();
    query.textContent = queryString;
    let totalBeforeLimit = this.shadowRoot.querySelector(".total-before-limit");

    // MR2-2604 - We don't currently know how many results we could have
    // gotten before limiting. For now, just show the total number of
    // results after limiting.
    totalBeforeLimit.dataset.l10nArgs = JSON.stringify({
      totalBeforeLimit: results.length,
    });

    let resultList = this.shadowRoot.querySelector(".history-result-list");
    let frag = document.createDocumentFragment();
    for (let result of results) {
      let li = document.createElement("li");
      li.appendChild(new HistoryResultEl(result));
      frag.appendChild(li);
    }
    resultList.replaceChildren(frag);

    this.#observer.observe(resultList.firstElementChild);
    this.#observer.observe(resultList.lastElementChild);
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
  constructor(result) {
    super();
    this.setAttribute("url", result.url);

    let shadowRoot = this.attachShadow({ mode: "open" });
    document.l10n.connectRoot(this.shadowRoot);

    let template = document.getElementById("template-history-result");
    let fragment = template.content.cloneNode(true);

    let button = fragment.querySelector(".history-result-button");
    button.setAttribute("url", result.url);
    button.title = result.title || result.url;

    let title = fragment.querySelector(".history-result-title");
    let url = fragment.querySelector(".history-result-url");
    title.textContent = result.title;
    title.title = result.title;
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
