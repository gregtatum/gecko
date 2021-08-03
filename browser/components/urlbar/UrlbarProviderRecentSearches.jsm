/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["UrlbarProviderRecentSearches"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const { FormHistory } = ChromeUtils.import(
  "resource://gre/modules/FormHistory.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  UrlbarProvider: "resource:///modules/UrlbarUtils.jsm",
  UrlbarResult: "resource:///modules/UrlbarResult.jsm",
  UrlbarSearchUtils: "resource:///modules/UrlbarSearchUtils.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
});

/**
 * This module exports a provider returning the user's newtab Top Sites.
 */

/**
 * A provider that returns the Top Sites shown on about:newtab.
 */
class ProviderRecentSearches extends UrlbarProvider {
  constructor() {
    super();
  }

  get PRIORITY() {
    return 1;
  }

  /**
   * Unique name for the provider, used by the context to filter on providers.
   * Not using a unique name will cause the newest registration to win.
   */
  get name() {
    return "RecentSearches";
  }

  /**
   * The type of the provider.
   */
  get type() {
    return UrlbarUtils.PROVIDER_TYPE.PROFILE;
  }

  /**
   * Whether this provider should be invoked for the given context.
   * If this method returns false, the providers manager won't start a query
   * with this provider, to save on resources.
   * @param {UrlbarQueryContext} queryContext The query context object
   * @returns {boolean} Whether this provider should be invoked for the search.
   */
  isActive(queryContext) {
    return (
      !queryContext.restrictSource &&
      !queryContext.searchString &&
      !queryContext.searchMode
    );
  }

  /**
   * Gets the provider's priority.
   * @param {UrlbarQueryContext} queryContext The query context object
   * @returns {number} The provider's priority for the given query.
   */
  getPriority(queryContext) {
    return this.PRIORITY;
  }

  /**
   * Starts querying.
   * @param {UrlbarQueryContext} queryContext The query context object
   * @param {function} addCallback Callback invoked by the provider to add a new
   *        result. A UrlbarResult should be passed to it.
   * @note Extended classes should return a Promise resolved when the provider
   *       is done searching AND returning results.
   */
  async startQuery(queryContext, addCallback) {
    let engine = UrlbarSearchUtils.getDefaultEngine(queryContext.isPrivate);
    let results = await FormHistory.search(
      ["value", "lastUsed"],
      { fieldname: "searchbar-history", source: engine.name },
      false,
      { limit: 5, order: "lastUsed DESC" }
    );
    for (let result of results) {
      let res = new UrlbarResult(
        UrlbarUtils.RESULT_TYPE.SEARCH,
        UrlbarUtils.RESULT_SOURCE.HISTORY,
        ...UrlbarResult.payloadAndSimpleHighlights(queryContext.tokens, {
          engine: [engine.name, UrlbarUtils.HIGHLIGHT.TYPED],
          suggestion: [result.value, UrlbarUtils.HIGHLIGHT.NONE],
        })
      );
      addCallback(this, res);
    }
  }
}

var UrlbarProviderRecentSearches = new ProviderRecentSearches();
