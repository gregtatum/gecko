/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
declare namespace HistoryPlus {
  export interface State {
    history: XPCOM.nsINavHistoryContainerResultNode[]
  }

  export type InitializeStoreValues = {
    history: XPCOM.nsINavHistoryContainerResultNode[]
  }

  export type Action = { type: "INITIALIZE_STORE" } & InitializeStoreValues;

  export type Reducer<S> = (state: S | undefined, action: Action) => S;

  export type Selector<T> = (state: State) => T;

  export type SortType =
    | "none"
    | "title"
    | "date"
    | "uri"
    | "visitcount"
    | "dateadded"
    | "lastmodified"
    | "tags"
    | "frecency";

  export type SortDirection = "ascending" | "descending";

  export type QueryHistoryOptions = Partial<{
    sortType: SortType,
    sortDirection: SortDirection,
    limit: number,
  }>;

  export type HostCategory =
    | "social-media"
    | "code-search"
    | "articles"
    | "videos"
    | "misc"
    | "documentation";

  export type Classifier = {
    [domain: string]: HostCategory
  }
}
