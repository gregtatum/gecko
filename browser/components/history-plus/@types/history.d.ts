/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
declare namespace HistoryPlus {
  export interface HistoryItem {
    // TODO
  }

  export interface State {
    history: HistoryItem[]
  }

  export type InitializeStoreValues = {
    history: HistoryItem[]
  }

  export type Action = { type: "INITIALIZE_STORE" } & InitializeStoreValues;

  export type Reducer<S> = (state: S | undefined, action: Action) => S;
}
