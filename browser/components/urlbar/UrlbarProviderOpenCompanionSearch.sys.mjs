/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const { UrlbarProvider, UrlbarUtils } = ChromeUtils.import(
  "resource:///modules/UrlbarUtils.jsm"
);

const lazy = {};

XPCOMUtils.defineLazyModuleGetters(lazy, {
  CompanionParent: "resource:///actors/CompanionParent.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarResult: "resource:///modules/UrlbarResult.jsm",
  UrlbarView: "resource:///modules/UrlbarView.jsm",
});

/**
 * This module exports a provider returning the user's newtab Top Sites.
 */
const ENABLED_PREF = "opencompanionsearch.enabled";
const DYNAMIC_RESULT_TYPE = "companionSearchLink";

const VIEW_TEMPLATE = {
  attributes: {
    selectable: true,
  },
  children: [
    {
      name: "icon",
      tag: "img",
      classList: ["urlbarView-favicon"],
    },
    {
      name: "openCompanionSearchLink",
      tag: "a",
      classList: ["urlbarView-title"],
    },
  ],
};

/**
 * A provider that returns the Top Sites shown on about:newtab.
 */
class ProviderOpenCompanionSearch extends UrlbarProvider {
  constructor() {
    super();
    lazy.UrlbarResult.addDynamicResultType(DYNAMIC_RESULT_TYPE);
    lazy.UrlbarView.addDynamicViewTemplate(DYNAMIC_RESULT_TYPE, VIEW_TEMPLATE);
  }

  /**
   * Unique name for the provider, used by the context to filter on providers.
   * Not using a unique name will cause the newest registration to win.
   */
  get name() {
    return "OpenCompanionSearch";
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
    return lazy.UrlbarPrefs.get(ENABLED_PREF) && queryContext.searchString;
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
    const result = new lazy.UrlbarResult(
      UrlbarUtils.RESULT_TYPE.DYNAMIC,
      UrlbarUtils.RESULT_SOURCE.OTHER_LOCAL,
      {
        input: queryContext.searchString,
        dynamicType: DYNAMIC_RESULT_TYPE,
      }
    );
    result.suggestedIndex = -1;
    addCallback(this, result);
  }

  getViewUpdate() {
    return {
      icon: {
        attributes: {
          src: "chrome://browser/skin/history.svg",
        },
      },
      openCompanionSearchLink: {
        l10n: {
          id: "urlbar-open-search-companion",
        },
      },
    };
  }

  pickResult(result) {
    let actor = lazy.CompanionParent.getCompanionActor();
    if (actor) {
      actor.viewHistoryTab(result.payload.input);
    }
  }
}

export var UrlbarProviderOpenCompanionSearch = new ProviderOpenCompanionSearch();
