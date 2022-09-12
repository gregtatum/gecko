/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { ReactDOM, React, Redux, ReactRedux } from "./contentcache/vendor.mjs";
import { reducers } from "./contentcache/reducers.mjs";
import { ContentCache } from "./contentcache/components.mjs";
import { reduxLogger, thunkMiddleware } from "./contentcache/utils.mjs";
import * as Actions from "./contentcache/actions.mjs";
import * as Selectors from "./contentcache/selectors.mjs";

/** @type {any[]} */
const middleware = [thunkMiddleware];
if (Services.prefs.getCharPref("browser.contentCache.logLevel") === "All") {
  // Only add the logger if it is required, since it fires for every action.
  middleware.push(reduxLogger);
}

const store = Redux.createStore(reducers, Redux.applyMiddleware(...middleware));

Object.assign(/** @type {any} */(window), {
  store,
  getState: store.getState,
  dispatch: store.dispatch,
});

/** @type {any} */ (window).store = store;
/** @type {any} */ (window).getState = store.getState;
/** @type {any} */ (window).dispatch = store.dispatch;

document.addEventListener("DOMContentLoaded", () => {
  const state = new ContentCacheState();
  new ContentCacheView(state);
});

class ContentCacheState {
  /**
   * The current search string in the input.
   * @type {string}
   */
  searchString = ""

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


}

class ContentCacheView {
  constructor(state) {
    this.state = state;
    window.view = this;
    this.searchInput = document.getElementById("searchInput");
    this.resultsContainer = document.getElementById("resultsContainer");
    this.resultRow = document.querySelector(".contentCacheResultsRow");

    this.resultRow.remove();

    this.updateRows();
    this.updateSearch();
    this.resultsContainer.style.display = "block"
    store.subscribe(this.updateRows.bind(this));

    this.resultRow.remove();

    this.searchInput.addEventListener("input", this.updateSearch.bind(this));
  }

  prevInputValue = null

  updateSearch() {
    const { value } = this.searchInput;
    if (value === this.prevInputValue) {
      return;
    }
    this.prevInputValue = value;
    store.dispatch(Actions.searchHistory(value))
  }

  prevRows = null;

  updateRows() {
    const rows = Selectors.getHistoryRows(store.getState());
    // Only update if the results have changed.
    if (rows === this.prevRows) {
      return;
    }
    this.prevRows = rows;


    const fragment = document.createDocumentFragment();

    // Build the results rows.
    for (const { description, row, title, url } of rows) {
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
