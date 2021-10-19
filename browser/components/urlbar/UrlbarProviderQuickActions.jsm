/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = [
  "UrlbarProviderQuickActionsFilter",
  "UrlbarProviderQuickActionsEmpty",
];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  DevToolsShim: "chrome://devtools-startup/content/DevToolsShim.jsm",
  OnlineServices: "resource:///modules/OnlineServices.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarProvider: "resource:///modules/UrlbarUtils.jsm",
  UrlbarResult: "resource:///modules/UrlbarResult.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
  UrlbarView: "resource:///modules/UrlbarView.jsm",
  KeywordTree: "resource:///modules/UrlbarQuickSuggest.jsm",
});

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "extraActions",
  "browser.companion.urlbar.extraactions",
  false
);

const hideExtra = () => !extraActions;

// These prefs are relative to the `browser.urlbar` branch.
const ENABLED_PREF = "suggest.quickactions";
const DYNAMIC_TYPE_NAME = "quickActions";

const MAX_RESULTS = 5;

const COMMANDS = {
  checkgmail: {
    commands: ["inbox", "email", "gmail", "check gmail", "google mail"],
    icon: "chrome://browser/content/urlbar/quickactions/gmail.svg",
    label: "Go to Inbox",
    callback: openUrl("https://gmail.com"),
    title: "Gmail",
    hide(isDefault) {
      if (isDefault) {
        return !OnlineServices.getMailCount("google");
      }
      return !OnlineServices.hasService("google");
    },
    showBadge() {
      return !!OnlineServices.getMailCount("google");
    },
  },
  checkoutlook: {
    commands: ["inbox", "email", "outlook", "check outlook"],
    icon: "chrome://browser/content/urlbar/quickactions/outlook.svg",
    label: "Go to Inbox",
    callback: () => {
      let inboxURL = OnlineServices.getInboxURL("microsoft");
      openUrl(inboxURL)();
    },
    title: "Outlook",
    hide(isDefault) {
      if (isDefault) {
        return !OnlineServices.getMailCount("microsoft");
      }
      return !OnlineServices.hasService("microsoft");
    },
    showBadge() {
      return !!OnlineServices.getMailCount("microsoft");
    },
  },
  createmeeting: {
    commands: ["create-meeting", "calendar", "google calendar"],
    icon: "chrome://browser/content/urlbar/quickactions/createmeeting.svg",
    label: "Schedule a meeting",
    callback: openUrl("https://meeting.new"),
    title: "Google Calendar",
  },
  createslides: {
    commands: ["create-slides", "slides", "google slides"],
    icon: "chrome://browser/content/urlbar/quickactions/createslides.svg",
    label: "Create Google slides",
    callback: openUrl("https://slides.new"),
    title: "Google Slides",
  },
  createsheet: {
    commands: ["create-sheet", "spreadsheet", "sheet", "google sheets"],
    icon: "chrome://browser/content/urlbar/quickactions/createsheet.svg",
    label: "Create a Google Sheet",
    callback: openUrl("https://sheets.new"),
    title: "Google Sheets",
  },
  createdoc: {
    commands: ["create-doc", "document", "google docs"],
    icon: "chrome://browser/content/urlbar/quickactions/createdoc.svg",
    label: "Create a Google doc",
    callback: openUrl("https://docs.new"),
    title: "Google Docs",
  },
  screenshot: {
    commands: ["screenshot"],
    icon: "chrome://browser/skin/screenshot.svg",
    label: "Take a Screenshot",
    hide: hideExtra,
    callback: () => {
      Services.obs.notifyObservers(null, "menuitem-screenshot-extension");
    },
    title: "Pro Client",
  },
  preferences: {
    commands: ["preferences"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Open Preferences",
    hide: hideExtra,
    callback: openUrl("about:preferences"),
    title: "Pro Client",
  },
  downloads: {
    commands: ["downloads"],
    icon: "chrome://browser/skin/downloads/downloads.svg",
    label: "Open Downloads",
    hide: hideExtra,
    callback: openUrl("about:downloads"),
    title: "Pro Client",
  },
  privacy: {
    commands: ["privacy", "private"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Open Preferences (Privacy & Security)",
    hide: hideExtra,
    callback: openUrl("about:preferences#privacy"),
    title: "Pro Client",
  },
  viewsource: {
    commands: ["view-source"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "View Source",
    hide: hideExtra,
    callback: () => {
      let window = BrowserWindowTracker.getTopWindow();
      let spec = window.gBrowser.selectedTab.linkedBrowser.documentURI.spec;
      openUrl("view-source:" + spec)();
    },
    title: "Pro Client",
  },
  inspect: {
    commands: ["inspector"],
    icon: "chrome://devtools/skin/images/tool-inspector.svg",
    label: "Open Inspector",
    hide: hideExtra,
    callback: () => {
      // TODO: This is supposed to be called with an element to start inspecting.
      DevToolsShim.inspectNode(
        BrowserWindowTracker.getTopWindow().gBrowser.selectedTab
      );
    },
    title: "Pro Client",
  },
  // TODO: Included this to as I think it highlights some potential danger. It was the most
  // used command in the gcli however I expect a lot of users would be surprised if we restarted
  // the browser as soon as they typed "restart" + ENTER.
  restart: {
    commands: ["restart"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Restart Firefox",
    hide: hideExtra,
    callback: restartBrowser,
    title: "Pro Client",
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
class ProviderQuickActionsBase extends UrlbarProvider {
  // A tree that maps keywords to a result.
  _tree = new KeywordTree();

  constructor() {
    super();
    UrlbarResult.addDynamicResultType(DYNAMIC_TYPE_NAME);

    let children = [...Array(MAX_RESULTS).keys()].map(i => {
      return {
        name: `button-${i}`,
        tag: "span",
        attributes: {
          class: "urlbarView-quickaction-row",
          role: "button",
        },
        children: [
          {
            name: `icon-${i}`,
            tag: "div",
            attributes: { class: "urlbarView-favicon" },
            children: [
              {
                name: `image-${i}`,
                tag: "img",
                attributes: { class: "urlbarView-favicon-img" },
              },
            ],
          },
          {
            name: `badge-${i}`,
            tag: "label",
            attributes: { class: "urlbarView-badge", hidden: "true" },
          },
          {
            name: `div-${i}`,
            tag: "div",
            attributes: { flex: "1" },
            children: [
              {
                name: `label-${i}`,
                tag: "span",
                attributes: { class: "urlbarView-label" },
              },
              {
                name: `title-${i}`,
                tag: "span",
                attributes: { class: "urlbarView-title" },
              },
            ],
          },
        ],
      };
    });

    UrlbarView.addDynamicViewTemplate(DYNAMIC_TYPE_NAME, {
      children,
    });

    for (const key in COMMANDS) {
      for (const command of COMMANDS[key].commands) {
        for (let i = 0; i <= command.length; i++) {
          let prefix = command.substring(0, command.length - i);
          let result = this._tree.get(prefix);
          if (result) {
            if (!result.includes(key)) {
              result.push(key);
            }
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
    return UrlbarUtils.PROVIDER_TYPE.PROFILE;
  }

  getSuggestedIndex() {
    return 1;
  }

  /**
   * Whether this provider should be invoked for the given context.
   * If this method returns false, the providers manager won't start a query
   * with this provider, to save on resources.
   * @param {UrlbarQueryContext} queryContext The query context object
   * @returns {boolean} Whether this provider should be invoked for the search.
   */
  isActive(queryContext) {
    return UrlbarPrefs.get(ENABLED_PREF);
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
    let results = this._tree.get(queryContext.searchString.toLowerCase());
    if (!results) {
      return;
    }
    results = results.filter(key => {
      let data = COMMANDS?.[key];
      if (data && data.hasOwnProperty("hide")) {
        return !data.hide(!queryContext.searchString);
      }
      return true;
    });
    if (!results.length) {
      return;
    }
    results.length =
      results.length > MAX_RESULTS ? MAX_RESULTS : results.length;
    const result = new UrlbarResult(
      UrlbarUtils.RESULT_TYPE.DYNAMIC,
      UrlbarUtils.RESULT_SOURCE.OTHER_LOCAL,
      {
        results,
        dynamicType: DYNAMIC_TYPE_NAME,
      }
    );
    result.suggestedIndex = this.getSuggestedIndex();
    result.searchString = queryContext.searchString;
    addCallback(this, result);
  }

  getViewUpdate(result) {
    let viewUpdate = {};
    [...Array(MAX_RESULTS).keys()].forEach(i => {
      let key = result.payload.results?.[i];
      let data = COMMANDS?.[key] || { icon: "", label: " " };
      let buttonAttributes = { "data-key": key };
      let hidden = !result.payload.results?.[i];
      buttonAttributes.hidden = hidden ? true : null;
      buttonAttributes.role = hidden ? "" : "button";
      viewUpdate[`button-${i}`] = { attributes: buttonAttributes };
      viewUpdate[`image-${i}`] = { attributes: { src: data.icon } };
      viewUpdate[`label-${i}`] = { textContent: data.label };
      viewUpdate[`title-${i}`] = { textContent: data.title };
      if (data.hasOwnProperty("showBadge")) {
        let showBadge = data.showBadge();
        if (showBadge) {
          viewUpdate[`badge-${i}`] = {
            attributes: { hidden: null },
          };
          if (data.hasOwnProperty("badgeValue")) {
            viewUpdate[`badge-${i}`].textContent = data.badgeValue();
          }
        } else {
          viewUpdate[`badge-${i}`] = {
            attributes: { hidden: true },
          };
        }
      }
    });
    return viewUpdate;
  }

  setBadge(document, name, number) {
    let index = 0;
    for (let command in COMMANDS) {
      if (command == name) {
        let badge = document.querySelector(`label[name="badge-${index}"]`);
        badge.textContent = number;
        badge.hidden = number == 0;
      }
      index++;
    }
  }

  async pickResult(results, itemPicked) {
    COMMANDS[itemPicked.dataset.key].callback();
  }
}

/**
 * The urlbar provider mechanism requires seperate providers for the
 * case when the urlbar is empty (priority 1) vs when a search term
 * has been entered.
 */
class ProviderQuickActionsEmpty extends ProviderQuickActionsBase {
  getPriority() {
    return 1;
  }
  isActive(queryContext) {
    return UrlbarPrefs.get(ENABLED_PREF) && !queryContext.searchString;
  }
}

/**
 * Handles results when a term has been entered.
 */
class ProviderQuickActionsFilter extends ProviderQuickActionsBase {}

var UrlbarProviderQuickActionsFilter = new ProviderQuickActionsFilter();
var UrlbarProviderQuickActionsEmpty = new ProviderQuickActionsEmpty();
