/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["UrlbarProviderCommands"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  DevToolsShim: "chrome://devtools-startup/content/DevToolsShim.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarProvider: "resource:///modules/UrlbarUtils.jsm",
  UrlbarResult: "resource:///modules/UrlbarResult.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
  UrlbarView: "resource:///modules/UrlbarView.jsm",
  KeywordTree: "resource:///modules/UrlbarQuickSuggest.jsm",
});

// These prefs are relative to the `browser.urlbar` branch.
const ENABLED_PREF = "suggest.commands";
const DYNAMIC_TYPE_NAME = "Commands";

const COMMANDS = {
  screenshot: {
    commands: ["/screenshot"],
    icon: "chrome://browser/skin/screenshot.svg",
    label: "Take Screenshot",
    callback: () => {
      Services.obs.notifyObservers(null, "menuitem-screenshot", true);
    },
  },
  preferences: {
    commands: ["/preferences"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Open Preferences",
    callback: openUrl("about:preferences"),
  },
  downloads: {
    commands: ["/downloads"],
    icon: "chrome://browser/skin/downloads/download-icons.svg#arrow-with-bar",
    label: "Open Downloads",
    callback: openUrl("about:downloads"),
  },
  privacy: {
    commands: ["/privacy"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Open Preferences (Privacy & Security)",
    callback: openUrl("about:preferences#privacy"),
  },
  viewsource: {
    commands: ["/view-source"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "View Source",
    callback: () => {
      let window = BrowserWindowTracker.getTopWindow();
      let spec = window.gBrowser.selectedTab.linkedBrowser.documentURI.spec;
      openUrl("view-source:" + spec)();
    },
  },
  inspect: {
    commands: ["/inspector"],
    icon: "chrome://devtools/skin/images/tool-inspector.svg",
    label: "Open Inspector",
    callback: () => {
      // TODO: This is supposed to be called with an element to start inspecting.
      DevToolsShim.inspectNode(
        BrowserWindowTracker.getTopWindow().gBrowser.selectedTab
      );
    },
  },
  // TODO: Included this to as I think it highlights some potential danger. It was the most
  // used command in the gcli however I expect a lot of users would be surprised if we restarted
  // the browser as soon as they typed "restart" + ENTER.
  restart: {
    commands: ["/restart"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Restart Firefox",
    callback: restartBrowser,
  },
};

function openUrl(url) {
  return function() {
    let window = BrowserWindowTracker.getTopWindow();
    window.gBrowser.loadOneTab(url, {
      inBackground: false,
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  };
}

function restartBrowser() {
  // Notify all windows that an application quit has been requested.
  let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(
    Ci.nsISupportsPRBool
  );
  Services.obs.notifyObservers(
    cancelQuit,
    "quit-application-requested",
    "restart"
  );
  // Something aborted the quit process.
  if (cancelQuit.data) {
    return;
  }
  // If already in safe mode restart in safe mode.
  if (Services.appinfo.inSafeMode) {
    Services.startup.restartInSafeMode(Ci.nsIAppStartup.eAttemptQuit);
  } else {
    Services.startup.quit(
      Ci.nsIAppStartup.eAttemptQuit | Ci.nsIAppStartup.eRestart
    );
  }
}

/**
 * A provider that returns a suggested url to the user based on what
 * they have currently typed so they can navigate directly.
 */
class ProviderCommands extends UrlbarProvider {
  // A tree that maps keywords to a result.
  _tree = new KeywordTree();

  constructor() {
    super();
    UrlbarResult.addDynamicResultType(DYNAMIC_TYPE_NAME);
    UrlbarView.addDynamicViewTemplate(DYNAMIC_TYPE_NAME, {
      attributes: {
        role: "button",
        class: "urlbarView-row-inner",
      },
      children: [
        {
          name: "content",
          tag: "span",
          attributes: { class: "urlbarView-no-wrap" },
          children: [
            {
              name: "icon",
              tag: "img",
              attributes: { class: "urlbarView-favicon" },
            },
            {
              name: "displayValue",
              tag: "strong",
            },
            {
              name: "outputAction",
              tag: "span",
            },
          ],
        },
      ],
    });

    for (const key in COMMANDS) {
      for (const command of COMMANDS[key].commands) {
        for (let i = 0; i < command.length; i++) {
          let prefix = command.substring(0, command.length - i);
          let result = this._tree.get(prefix);
          if (result) {
            result.push(key);
          } else {
            result = [key];
          }
          this._tree.set(prefix, result);
        }
      }
    }
  }

  /**
   * Returns the name of this provider.
   * @returns {string} the name of this provider.
   */
  get name() {
    return DYNAMIC_TYPE_NAME;
  }

  /**
   * The type of the provider.
   */
  get type() {
    return UrlbarUtils.PROVIDER_TYPE.HEURISTIC;
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
      queryContext.trimmedSearchString &&
      !queryContext.searchMode &&
      UrlbarPrefs.get(ENABLED_PREF)
    );
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
    let results = this._tree.get(queryContext.searchString);
    if (!results) {
      return;
    }
    for (let key of results) {
      let res = COMMANDS[key];
      const result = new UrlbarResult(
        UrlbarUtils.RESULT_TYPE.DYNAMIC,
        UrlbarUtils.RESULT_SOURCE.OTHER_LOCAL,
        {
          value: key,
          displayValue: res.label,
          icon: res.icon,
          dynamicType: DYNAMIC_TYPE_NAME,
        }
      );
      result.suggestedIndex = 1;
      addCallback(this, result);
    }
  }

  getViewUpdate(result) {
    const viewUpdate = {
      icon: {
        attributes: {
          src: result.payload.icon,
        },
      },
      displayValue: {
        textContent: result.payload.displayValue,
      },
      outputAction: {
        textContent: "",
      },
    };

    return viewUpdate;
  }

  async pickResult({ payload }) {
    let value = payload.value;
    // TODO: We probably want the UrlBar to do this?
    let win = BrowserWindowTracker.getTopWindow();
    win.gURLBar.blur();
    COMMANDS[value].callback();
  }
}

var UrlbarProviderCommands = new ProviderCommands();
