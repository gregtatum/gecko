/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * @ts-check
 */

/**
 * @template T
 * @param {T | void | null} item
 * @param {string} [message]
 * @returns T
 */
export function ensureExists(item, message) {
  if (item === null) {
    throw new Error(message || "Expected an item to exist, and it was null.");
  }
  if (item === undefined) {
    throw new Error(
      message || "Expected an item to exist, and it was undefined."
    );
  }
  return item;
}

export class UnhandledCaseError extends Error {
  /**
   * @param {never} value - Check that
   * @param {string} typeName - A friendly type name.
   */
  constructor(value, typeName) {
    super(`There was an unhandled case for "${typeName}": ${value}`);
    this.name = "UnhandledCaseError";
  }
}

/**
 * @param {HistoryPlus.SortType?} sortType
 * @param {HistoryPlus.SortDirection?} sortDirection
 * @return {number}
 */
function getSortingEnumValue(sortType, sortDirection = "ascending") {
  const options = Ci.nsINavHistoryQueryOptions;
  const dir = sortDirection === "ascending" ? "_ASCENDING" : "_DESCENDING";
  if (!sortType) {
    return options.SORT_BY_NONE;
  }
  switch (sortType) {
    case "none":
      return options.SORT_BY_NONE;
    case "title":
      return options["SORT_BY_TITLE" + dir];
    case "date":
      return options["SORT_BY_DATE" + dir];
    case "uri":
      return options["SORT_BY_URI" + dir];
    case "visitcount":
      return options["SORT_BY_VISITCOUNT" + dir];
    case "dateadded":
      return options["SORT_BY_DATEADDED" + dir];
    case "lastmodified":
      return options["SORT_BY_LASTMODIFIED" + dir];
    case "tags":
      return options["SORT_BY_TAGS" + dir];
    case "frecency":
      return options["SORT_BY_FRECENCY" + dir];
    default:
      throw new UnhandledCaseError(sortType, "SortType");
  }
}

/**
 * Create a more ergonomic API for interacting with the query history.
 * @param {HistoryPlus.QueryHistoryOptions} options
 * @returns {NavHistoryIterator}
 */
export function queryHistory(options) {
  const historyService = Cc[
    "@mozilla.org/browser/nav-history-service;1"
  ].getService(Ci.nsINavHistoryService);

  // Setup the query.
  const query = historyService.getNewQuery();
  const queryOptions = ensureExists(historyService.getNewQueryOptions());
  queryOptions.sortingMode = getSortingEnumValue(
    options.sortType,
    options.sortDirection
  );

  const results = ensureExists(
    historyService.executeQuery(query, queryOptions)
  );

  const root = ensureExists(results.root);

  // The container for the result must be opened before it's accessed.
  root.containerOpen = true;

  // Return an iterator for the results.
  /** @type {any} */
  const iter = new NavHistoryIterator(root, options.limit);
  return iter;
}

/**
 * @implements {Iterator<XPCOM.nsINavHistoryResultNode>}
 */
class NavHistoryIterator {
  /**
   * @param {XPCOM.nsINavHistoryContainerResultNode} root
   * @param {number} [limit]
   */
  constructor(root, limit = Infinity) {
    this.root = root;
    this.count = Math.min(limit, root.childCount);
    this.index = 0;
  }

  /**
   * @return {Iterator<nsINavHistoryResultNode>}
   */
  [Symbol.iterator]() {
    this.index = 0;
    return this;
  }

  /**
   * @return {IteratorResult<XPCOM.nsINavHistoryContainerResultNode>}
   */
  next() {
    const { index, count, root } = this;
    if (index < count) {
      const value = root.getChild(index);
      this.index++;
      return { done: false, value };
    }
    return { done: true };
  }
}
