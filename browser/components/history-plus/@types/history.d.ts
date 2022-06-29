/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This namespace provides a convenient global to refer to types for the HistoryPlus
 * project. Otherwise these types would need to be manually imported via the verbose:
 *
 *   import("../../@types/history.d.ts").TypeName
 *
 * Instead the type can be accessed via:
 *
 *   HistoryPlus.TypeName
 */
declare namespace HistoryPlus {

  /**
   * A utility function to extract the values from an Object.
   */
  type Values<T> = T[keyof T];

  /**
   * Action creators return an action object. This utility type extracts the returned
   * type so that the actions don't need to be manually typed.
   */
  type ExtractActions<T extends {[key: string]: (...args: any) => any}> = Values<{
    [FnName in keyof T]: ReturnType<
      T[FnName]
    >;
  }>;

  /**
   * Automatically extract the action object from the action creators.
   */
  export type Action =
    | ExtractActions<typeof import("../src/actions/plain")>
    | ExtractActions<typeof import('../src/actions/thunks.js')["PlainInternal"]>;

  export type Reducers = typeof import("../src/reducers");
  export type State = ReturnType<Reducers["reducers"]>;

  type ThunkDispatch = <Returns>(action: Thunk<Returns>) => Returns;
  type PlainDispatch = (action: Action) => Action;

  /**
   * This GetState function knows about the specific State from the store.
   */
  export type GetState = () => State;

  type Reducer<S> = (state: S | undefined, action: Action) => S;

  /**
   * This dispatch is augmented to supports both thunks and plain dispatch.
   * For more information on thunks see: https://redux.js.org/usage/writing-logic-thunks
   */
  export type Dispatch = PlainDispatch & ThunkDispatch;

  /**
   * This store knows about the HistoryPlus State and Actions.
   */
  export type Store = {
    dispatch: Dispatch;
    getState(): State;
    subscribe(listener: () => void): unknown;
    replaceReducer(nextReducer: Reducer<State>): void;
  };

  /**
   * This is the return type for a Thunk action creator.
   */
  export type Thunk<Returns = void> = (
    dispatch: Dispatch,
    getState: () => State,
  ) => Returns;


  /**
   * The information returned from a content cache query.
   */
  export interface HistoryRow {
    url: string,
    title: string,
    description: string,
    row: any,
   }

  type PlacesUtils = (typeof import("resource://gre/modules/PlacesUtils.jsm"))["PlacesUtils"];

  /**
   * This is the database connection. It's useful to refer to when passing it between functions.
   */
  export type Database = Awaited<ReturnType<
    PlacesUtils["promiseDBConnection"]
  >>;
}
