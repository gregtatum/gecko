/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
declare namespace HistoryPlus {

  type Values<T> = T[keyof T];

  type PlainActions = Values<{
    [FnName in keyof typeof import("../src/actions-plain")]: ReturnType<
      typeof import("../src/actions-plain")[FnName]
    >;
  }>;

  export type Action = PlainActions;

  type Reducers = typeof import("../src/reducers");
  export type State = ReturnType<Reducers["reducers"]>;

  interface nsINavHistoryContainerResultNode {

  }

  export type InitializeStoreValues = {
    history: nsINavHistoryContainerResultNode[]
  }

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

  export type UseState<T> = [T, React.Dispatch<React.SetStateAction<T>>]

}
