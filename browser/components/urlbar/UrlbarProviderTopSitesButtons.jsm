/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["UrlbarProviderTopSitesButtons"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  AboutNewTab: "resource:///modules/AboutNewTab.jsm",
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  Services: "resource://gre/modules/Services.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarProvider: "resource:///modules/UrlbarUtils.jsm",
  UrlbarResult: "resource:///modules/UrlbarResult.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
  UrlbarView: "resource:///modules/UrlbarView.jsm",
  TOP_SITES_DEFAULT_ROWS: "resource://activity-stream/common/Reducers.jsm",
});

/**
 * This module exports a provider returning the user's newtab Top Sites.
 */

const DYNAMIC_TYPE_NAME = "topSitesButtons";
const MAX_BUTTONS = 8;

function openUrl(url) {
  let window = BrowserWindowTracker.getTopWindow();
  window.gBrowser.loadOneTab(url, {
    inBackground: false,
    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
  });
}

/**
 * A provider that returns the Top Sites shown on about:newtab.
 */
class ProviderTopSitesButtons extends UrlbarProvider {
  constructor() {
    super();
    UrlbarResult.addDynamicResultType(DYNAMIC_TYPE_NAME);
    let children = [...Array(MAX_BUTTONS).keys()].map((v, i) => {
      return {
        name: `button-${i}`,
        tag: "span",
        attributes: {
          class: "urlbarView-topsitesbutton-row",
          role: "button",
        },
        children: [
          {
            name: `icon-${i}`,
            tag: "img",
            attributes: { class: "urlbarView-favicon" },
          },
          {
            name: `label-${i}`,
            tag: "span",
            attributes: { class: "urlbarView-title" },
          },
        ],
      };
    });

    UrlbarView.addDynamicViewTemplate(DYNAMIC_TYPE_NAME, {
      children,
    });
  }

  get PRIORITY() {
    // Top sites are prioritized over the UrlbarProviderPlaces provider.
    return 1;
  }

  /**
   * Unique name for the provider, used by the context to filter on providers.
   * Not using a unique name will cause the newest registration to win.
   */
  get name() {
    return "UrlbarProviderTopSitesButtons";
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
    // If system.topsites is disabled, we would get stale or empty Top Sites
    // data. We check this condition here instead of in isActive because we
    // still want this provider to be restricting even if this is not true. If
    // it wasn't restricting, we would show the results from UrlbarProviderPlaces's
    // empty search behaviour. We aren't interested in those since they are very
    // similar to Top Sites and thus might be confusing, especially since users
    // can configure Top Sites but cannot configure the default empty search
    // results. See bug 1623666.
    if (
      !UrlbarPrefs.get("suggest.topsites") ||
      !Services.prefs.getBoolPref(
        "browser.newtabpage.activity-stream.feeds.system.topsites",
        false
      )
    ) {
      return;
    }

    let sites = AboutNewTab.getTopSites();
    sites = sites.filter(site => site && !site.searchTopSite);
    sites = sites.filter(site => !site.sponsored_position);

    // This is done here, rather than in the global scope, because
    // TOP_SITES_DEFAULT_ROWS causes the import of Reducers.jsm, and we want to
    // do that only when actually querying for Top Sites.
    if (this.topSitesRows === undefined) {
      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        "topSitesRows",
        "browser.newtabpage.activity-stream.topSitesRows",
        TOP_SITES_DEFAULT_ROWS
      );
    }

    sites = sites.map(link => {
      return {
        url: link.url_urlbar || link.url,
        title: link.label || link.title || link.hostname || "",
        favicon: link.smallFavicon || link.favicon || undefined,
      };
    });

    const result = new UrlbarResult(
      UrlbarUtils.RESULT_TYPE.DYNAMIC,
      UrlbarUtils.RESULT_SOURCE.OTHER_LOCAL,
      {
        sites,
        dynamicType: DYNAMIC_TYPE_NAME,
      }
    );
    result.suggestedIndex = 0;
    addCallback(this, result);
  }

  getViewUpdate(result) {
    let viewUpdate = {};
    [...Array(MAX_BUTTONS).keys()].forEach((v, i) => {
      let data = result.payload.sites?.[i] || {
        url: "",
        favicon: "",
        title: "",
      };
      viewUpdate[`button-${i}`] = { attributes: { "data-url": data.url } };
      viewUpdate[`icon-${i}`] = { attributes: { src: data.favicon } };
      viewUpdate[`label-${i}`] = { textContent: data.title };
      if (!result.payload.sites?.[i]) {
        viewUpdate[`button-${i}`] = { attributes: { hidden: true, role: "" } };
      }
    });
    return viewUpdate;
  }

  async pickResult(results, itemPicked) {
    openUrl(itemPicked.dataset.url);
  }
}

var UrlbarProviderTopSitesButtons = new ProviderTopSitesButtons();
