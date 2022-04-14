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

const { AppConstants } = ChromeUtils.import(
  "resource://gre/modules/AppConstants.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  DevToolsShim: "chrome://devtools-startup/content/DevToolsShim.jsm",
  OnlineServices: "resource:///modules/OnlineServices.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarProvider: "resource:///modules/UrlbarUtils.jsm",
  UrlbarResult: "resource:///modules/UrlbarResult.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
  UrlbarView: "resource:///modules/UrlbarView.jsm",
  WorkshopParentAccess: "resource:///modules/WorkshopParentAccess.jsm",
});

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "extraActions",
  "browser.companion.urlbar.extraactions",
  false
);

const extraActionsEnabled = () => extraActions;

const GOOGLE_ACTION_URLS = {
  email: "https://mail.google.com/mail/u/?authuser={email}",
  sheets: "https://docs.google.com/spreadsheets/create?authuser={email}",
  docs: "https://docs.google.com/document/create?authuser={email}",
  slides: "https://docs.google.com/presentation/create?authuser={email}",
  meeting: "https://calendar.google.com/calendar/u/{email}/r/eventedit",
};

const formatGoogleURL = (type, fallbackURL, email = "") => {
  let url = fallbackURL;

  if (Cu.isInAutomation) {
    url = Services.prefs.getStringPref(
      "browser.pinebuild.quickactions.testURL",
      ""
    );
  } else if (email) {
    url = GOOGLE_ACTION_URLS[type];
  }

  return url.replace(
    "{email}",
    type === "meeting" ? email : encodeURIComponent(email)
  );
};

const shouldShowEmailResult = (accountType, isDefault) => {
  if (isDefault) {
    return hasUnreadMessages(accountType);
  }

  return hasConnectedAccount(accountType);
};

const hasUnreadMessages = accountType => {
  if (WorkshopParentAccess.workshopEnabled) {
    return WorkshopParentAccess.getUnreadMessageCount(accountType);
  }

  if (Cu.isInAutomation) {
    accountType = "testservice";
  }
  return OnlineServices.getMailCount(accountType);
};

const hasConnectedAccount = accountType => {
  if (WorkshopParentAccess.workshopEnabled) {
    return WorkshopParentAccess.hasConnectedAccount(accountType);
  }

  if (Cu.isInAutomation) {
    accountType = "testservice";
  }
  return OnlineServices.hasService(accountType);
};

// These prefs are relative to the `browser.urlbar` branch.
const ENABLED_PREF = "suggest.quickactions";
const DYNAMIC_TYPE_NAME = "quickActions";

const MAX_RESULTS = 5;

const COMMANDS = {
  checkgmail: {
    commands: ["inbox", "email", "gmail", "check gmail", "google mail"],
    icon: "chrome://browser/content/urlbar/quickactions/gmail.svg",
    label: "Go to Inbox",
    title: "Gmail",
    serviceType: "google",
    hide(isDefault) {
      return shouldShowEmailResult("google", isDefault);
    },
    showBadge() {
      return hasUnreadMessages("google");
    },
    callback: ({ email } = {}) => {
      const url = formatGoogleURL("email", "https://gmail.com", email);
      UrlbarUtils.openUrl(url);
    },
  },
  checkoutlook: {
    commands: ["inbox", "email", "outlook", "check outlook"],
    icon: "chrome://browser/content/urlbar/quickactions/outlook.svg",
    label: "Go to Inbox",
    serviceType: "microsoft",
    title: "Outlook",
    hide(isDefault) {
      return shouldShowEmailResult("microsoft", isDefault);
    },
    showBadge() {
      return hasUnreadMessages("microsoft");
    },
    callback: ({ inboxUrl } = {}) => {
      UrlbarUtils.openUrl(inboxUrl);
    },
  },
  createmeeting: {
    commands: ["create-meeting", "calendar", "google calendar"],
    icon: "chrome://browser/content/urlbar/quickactions/createmeeting.svg",
    label: "Schedule a meeting",
    title: "Google Calendar",
    serviceType: "google",
    callback: ({ email } = {}) => {
      const url = formatGoogleURL("meeting", "https://meeting.new", email);
      UrlbarUtils.openUrl(url);
    },
  },
  createslides: {
    commands: ["create-slides", "slides", "google slides"],
    icon: "chrome://browser/content/urlbar/quickactions/createslides.svg",
    label: "Create Google slides",
    title: "Google Slides",
    serviceType: "google",
    callback: ({ email } = {}) => {
      const url = formatGoogleURL("slides", "https://slides.new", email);
      UrlbarUtils.openUrl(url);
    },
  },
  createsheet: {
    commands: ["create-sheet", "spreadsheet", "sheets", "google sheets"],
    icon: "chrome://browser/content/urlbar/quickactions/createsheet.svg",
    label: "Create a Google Sheet",
    title: "Google Sheets",
    serviceType: "google",
    callback: ({ email } = {}) => {
      const url = formatGoogleURL("sheets", "https://sheets.new", email);
      UrlbarUtils.openUrl(url);
    },
  },
  createdoc: {
    commands: ["create-doc", "document", "docs", "google docs"],
    icon: "chrome://browser/content/urlbar/quickactions/createdoc.svg",
    label: "Create a Google doc",
    title: "Google Docs",
    serviceType: "google",
    callback: ({ email } = {}) => {
      const url = formatGoogleURL("docs", "https://docs.new", email);
      UrlbarUtils.openUrl(url);
    },
  },
  screenshot: {
    commands: ["screenshot"],
    icon: "chrome://browser/skin/screenshot.svg",
    label: "Take a Screenshot",
    hide: extraActionsEnabled,
    callback: () => {
      Services.obs.notifyObservers(null, "menuitem-screenshot-extension");
    },
    title: "Flowstate",
  },
  preferences: {
    commands: ["preferences"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Open Preferences",
    hide: extraActionsEnabled,
    url: "about:preferences",
    title: "Flowstate",
  },
  downloads: {
    commands: ["downloads"],
    icon: "chrome://browser/skin/downloads/downloads.svg",
    label: "Open Downloads",
    hide: extraActionsEnabled,
    url: "about:downloads",
    title: "Flowstate",
  },
  privacy: {
    commands: ["privacy", "private"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Open Preferences (Privacy & Security)",
    hide: extraActionsEnabled,
    callback: "about:preferences#privacy",
    title: "Flowstate",
  },
  viewsource: {
    commands: ["view-source"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "View Source",
    hide: extraActionsEnabled,
    callback: () => {
      let window = BrowserWindowTracker.getTopWindow();
      let spec = window.gBrowser.selectedTab.linkedBrowser.documentURI.spec;
      UrlbarUtils.openUrl("view-source:" + spec);
    },
    title: "Flowstate",
  },
  inspect: {
    commands: ["inspector"],
    icon: "chrome://devtools/skin/images/tool-inspector.svg",
    label: "Open Inspector",
    hide: extraActionsEnabled,
    callback: () => {
      // TODO: This is supposed to be called with an element to start inspecting.
      DevToolsShim.inspectNode(
        BrowserWindowTracker.getTopWindow().gBrowser.selectedTab
      );
    },
    title: "Flowstate",
  },
  // TODO: Included this to as I think it highlights some potential danger. It was the most
  // used command in the gcli however I expect a lot of users would be surprised if we restarted
  // the browser as soon as they typed "restart" + ENTER.
  restart: {
    commands: ["restart"],
    icon: "chrome://global/skin/icons/settings.svg",
    label: "Restart Firefox",
    hide: extraActionsEnabled,
    callback: restartBrowser,
    title: "Flowstate",
  },
};

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
  _serviceData = {};

  constructor() {
    super();
    UrlbarResult.addDynamicResultType(DYNAMIC_TYPE_NAME);

    let children = [...Array(MAX_RESULTS).keys()].map(i => {
      // reorder child nodes for Flowstate
      if (AppConstants.PINEBUILD) {
        return {
          name: `button-${i}`,
          tag: "span",
          attributes: {
            class: "urlbarView-quickaction-row",
            role: "button",
          },
          children: [
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
              ],
            },
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
                {
                  name: `title-${i}`,
                  tag: "span",
                  attributes: { class: "urlbarView-title" },
                },
              ],
            },
          ],
        };
      }
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

    results = await Promise.all(
      results.map(async key => {
        let data = COMMANDS?.[key];
        let result = { key, isShown: true };
        if (data && data.hasOwnProperty("showBadge")) {
          result.showBadge = await data.showBadge();
        }
        if (data && data.hasOwnProperty("hide")) {
          result.isShown = await data.hide(!queryContext.searchString);
        }
        if (data && data.hasOwnProperty("serviceType")) {
          if (data.serviceType === "google") {
            result.accountAddress = await this.getAccountAddress("google");
          } else if (data.serviceType === "microsoft") {
            result.inboxUrl = await this.getInboxUrl("microsoft");
          }
        }
        return result;
      })
    ).then(res => res.filter(({ isShown }) => isShown));

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

  async getInboxUrl(accountType) {
    const serviceData = this._serviceData[accountType];
    if (serviceData?.inboxUrl) {
      return serviceData.inboxUrl;
    }

    let inboxUrl;
    if (WorkshopParentAccess.workshopEnabled) {
      inboxUrl = await WorkshopParentAccess.getInboxUrl(accountType);
      this.setServiceData(accountType, "inboxUrl", inboxUrl);
      return inboxUrl;
    }

    inboxUrl = OnlineServices.getInboxURL(accountType);
    this.setServiceData(accountType, "inboxUrl", inboxUrl);
    return inboxUrl;
  }

  async getAccountAddress(accountType) {
    const serviceData = this._serviceData[accountType];
    if (serviceData?.accountAddress) {
      return serviceData.accountAddress;
    }

    if (WorkshopParentAccess.workshopEnabled) {
      const account = await WorkshopParentAccess.getAccountByType(accountType);
      this.setServiceData(accountType, "accountAddress", account?.name);
      return account?.name || "";
    }

    // Force call to load() in OnlineService to retrieve stored service data
    OnlineServices.getAllServices();
    if (Cu.isInAutomation) {
      accountType = "testservice";
    }
    if (OnlineServices.hasService(accountType)) {
      const service = OnlineServices.getServices(accountType)[0];
      const email = service.getAccountAddress();
      this.setServiceData(accountType, "accountAddress", email);
      return email || "";
    }

    return "";
  }

  setServiceData(accountType, prop, val) {
    if (!this._serviceData[accountType]) {
      this._serviceData[accountType] = {};
    }
    this._serviceData[accountType][prop] = val;
  }

  getViewUpdate(result) {
    let viewUpdate = {};
    [...Array(MAX_RESULTS).keys()].forEach(i => {
      let item = result.payload.results?.[i];
      let hidden = !item;
      let key = item?.key;
      let data = COMMANDS?.[key] || { icon: "", label: " " };
      let buttonAttributes = { "data-key": key };
      buttonAttributes.hidden = hidden ? true : null;
      buttonAttributes.role = hidden ? "" : "button";
      viewUpdate[`button-${i}`] = { attributes: buttonAttributes };
      viewUpdate[`image-${i}`] = { attributes: { src: data.icon } };
      viewUpdate[`label-${i}`] = { textContent: data.label };
      viewUpdate[`title-${i}`] = { textContent: data.title };
      if (item?.hasOwnProperty("showBadge")) {
        let showBadge = item.showBadge;
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
      } else {
        viewUpdate[`badge-${i}`] = {
          attributes: { hidden: true },
        };
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

  pickResult(result, itemPicked) {
    let key = itemPicked.dataset.key;
    let command = COMMANDS[itemPicked.dataset.key];
    let data = result.payload.results.find(item => item.key === key);

    if (command.url) {
      UrlbarUtils.openUrl(command.url);
    } else {
      command.callback({
        email: data?.accountAddress,
        inboxUrl: data?.inboxUrl,
      });
    }

    this._serviceData = {};
  }

  /**
   * Adds a new QuickAction.
   * @param {string} command The command to add.
   * @param {string} definition An object that describes the command.
   */
  addAction(command, definition) {
    COMMANDS[command] = definition;
    this._tree.set(command, [command]);
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

// Token used as a key to store results within the Map, cannot be used
// within a keyword.
const RESULT_KEY = "^";

/**
 * This is an implementation of a Map based Tree. We can store
 * multiple keywords that point to a single term, for example:
 *
 *   tree.add("headphones", "headphones");
 *   tree.add("headph", "headphones");
 *   tree.add("earphones", "headphones");
 *
 *   tree.get("headph") == "headphones"
 *
 * The tree can store multiple prefixes to a term efficiently
 * so ["hea", "head", "headp", "headph", "headpho", ...] wont lead
 * to duplication in memory. The tree will only return a result
 * for keywords that have been explcitly defined and not attempt
 * to guess based on prefix.
 *
 * Once a tree have been build, it can be flattened with `.flatten`
 * the tree can then be serialised and deserialised with `.toJSON`
 * and `.fromJSON`.
 */
class KeywordTree {
  constructor() {
    this.tree = new Map();
  }

  /*
   * Set a keyword for a result.
   */
  set(keyword, id) {
    if (keyword.includes(RESULT_KEY)) {
      throw new Error(`"${RESULT_KEY}" is reserved`);
    }
    let tree = this.tree;
    for (let x = 0, c = ""; (c = keyword.charAt(x)); x++) {
      let child = tree.get(c) || new Map();
      tree.set(c, child);
      tree = child;
    }
    tree.set(RESULT_KEY, id);
  }

  /**
   * Get the result for a given phrase.
   *
   * @param {string} query
   *   The query string.
   * @returns {*}
   *   The matching result in the tree or null if there isn't a match.
   */
  get(query) {
    query = query.trimStart() + RESULT_KEY;
    let node = this.tree;
    let phrase = "";
    while (phrase.length < query.length) {
      // First, assume the tree isn't flattened and try to look up the next char
      // in the query.
      let key = query[phrase.length];
      let child = node.get(key);
      if (!child) {
        // Not found, so fall back to looking through all of the node's keys.
        key = null;
        for (let childKey of node.keys()) {
          let childPhrase = phrase + childKey;
          if (childPhrase == query.substring(0, childPhrase.length)) {
            key = childKey;
            break;
          }
        }
        if (!key) {
          return null;
        }
        child = node.get(key);
      }
      node = child;
      phrase += key;
    }
    if (phrase.length != query.length) {
      return null;
    }
    // At this point, `node` is the found result.
    return node;
  }

  /*
   * We flatten the tree by combining consecutive single branch keywords
   * with the same results into a longer keyword. so ["a", ["b", ["c"]]]
   * becomes ["abc"], we need to be careful that the result matches so
   * if a prefix search for "hello" only starts after 2 characters it will
   * be flattened to ["he", ["llo"]].
   */
  flatten() {
    this._flatten("", this.tree, null);
  }

  /**
   * Recursive flatten() helper.
   *
   * @param {string} key
   *   The key for `node` in `parent`.
   * @param {Map} node
   *   The currently visited node.
   * @param {Map} parent
   *   The parent of `node`, or null if `node` is the root.
   */
  _flatten(key, node, parent) {
    // Flatten the node's children.  We need to store node.entries() in an array
    // rather than iterating over them directly because _flatten() can modify
    // them during iteration.
    for (let [childKey, child] of [...node.entries()]) {
      if (childKey != RESULT_KEY) {
        this._flatten(childKey, child, node);
      }
    }
    // If the node has a single child, then replace the node in `parent` with
    // the child.
    if (node.size == 1 && parent) {
      parent.delete(key);
      let childKey = [...node.keys()][0];
      parent.set(key + childKey, node.get(childKey));
    }
  }

  /*
   * Turn a tree into a serialisable JSON object.
   */
  toJSONObject(map = this.tree) {
    let tmp = {};
    for (let [key, val] of map) {
      if (val instanceof Map) {
        tmp[key] = this.toJSONObject(val);
      } else {
        tmp[key] = val;
      }
    }
    return tmp;
  }

  /*
   * Build a tree from a serialisable JSON object that was built
   * with `toJSON`.
   */
  fromJSON(json) {
    this.tree = this.JSONObjectToMap(json);
  }

  JSONObjectToMap(obj) {
    let map = new Map();
    for (let key of Object.keys(obj)) {
      if (typeof obj[key] == "object") {
        map.set(key, this.JSONObjectToMap(obj[key]));
      } else {
        map.set(key, obj[key]);
      }
    }
    return map;
  }
}

/**
 * Handles results when a term has been entered.
 */
class ProviderQuickActionsFilter extends ProviderQuickActionsBase {}

var UrlbarProviderQuickActionsFilter = new ProviderQuickActionsFilter();
var UrlbarProviderQuickActionsEmpty = new ProviderQuickActionsEmpty();
