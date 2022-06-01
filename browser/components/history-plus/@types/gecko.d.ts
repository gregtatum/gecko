/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This file contains type stubs for loading things from Gecko. All of these
 * types should be used in the correct places eventually. It was copied from
 * devtools/client/performance-new/@types/gecko.d.ts
 */

/**
 * Namespace anything that has its types mocked out here. These definitions are
 * only "good enough" to get the type checking to pass in this directory.
 * Eventually some more structured solution should be found. This namespace is
 * global and makes sure that all the definitions inside do not clash with
 * naming.
 */
declare namespace MockedExports {
  /**
   * This interface teaches ChromeUtils.import how to find modules.
   */
  interface KnownModules {
    "resource://gre/modules/Services.jsm":
      typeof import("resource://gre/modules/Services.jsm");
    "Services":
      typeof import("Services");
    "chrome":
      typeof import("chrome");
    "resource://gre/modules/osfile.jsm":
      typeof import("resource://gre/modules/osfile.jsm");
    "resource://gre/modules/AppConstants.jsm":
      typeof import("resource://gre/modules/AppConstants.jsm");
    "resource://devtools/shared/Loader.jsm":
      typeof import("resource://devtools/shared/Loader.jsm");
    "resource://devtools/shared/loader/browser-loader.js":
      typeof import("resource://devtools/shared/loader/browser-loader.js");
    "resource://gre/modules/PlacesUtils.jsm":
      typeof import("resource://gre/modules/PlacesUtils.jsm");
  }

  interface ChromeUtils {
    /**
     * This function reads the KnownModules and resolves which import to use.
     * If you are getting the TS2345 error:
     *
     *  Argument of type '"resource:///.../file.jsm"' is not assignable to parameter
     *  of type
     *
     * Then add the file path to the KnownModules above.
     */
    import: <S extends keyof KnownModules>(module: S) => KnownModules[S];
    exportFunction: (fn: Function, scope: object, options?: object) => void;
    cloneInto: (value: any, scope: object, options?: object) => void;
  }

  interface nsINavHistoryService {}

  type ServiceGetter<Key, Service> = {
    getService(key: Key): Service;
  }

  interface MessageManager {
    loadFrameScript(url: string, flag: boolean): void;
    sendAsyncMessage: (event: string, data: any) => void;
    addMessageListener: (event: string, listener: (event: any) => void) => void;
  }

  interface Browser {
    addWebTab: (url: string, options: any) => BrowserTab;
    contentPrincipal: any;
    selectedTab: BrowserTab;
    selectedBrowser?: ChromeBrowser;
    messageManager: MessageManager;
    ownerDocument?: ChromeDocument;
  }

  interface BrowserTab {
    linkedBrowser: Browser;
  }

  interface ChromeWindow {
    gBrowser: Browser;
  }

  interface ChromeBrowser {
    browsingContext?: BrowsingContext;
  }

  interface BrowsingContext {
    id: number;
  }

  type GetPref<T> = (prefName: string, defaultValue?: T) => T;
  type SetPref<T> = (prefName: string, value?: T) => T;

  interface nsIURI {}

  type Services = {
    prefs: {
      clearUserPref: (prefName: string) => void;
      getStringPref: GetPref<string>;
      setStringPref: SetPref<string>;
      getCharPref: GetPref<string>;
      setCharPref: SetPref<string>;
      getIntPref: GetPref<number>;
      setIntPref: SetPref<number>;
      getBoolPref: GetPref<boolean>;
      setBoolPref: SetPref<boolean>;
      addObserver: any;
    };
    profiler: any;
    platform: string;
    obs: {
      addObserver: (observer: object, type: string) => void;
      removeObserver: (observer: object, type: string) => void;
    };
    wm: {
      getMostRecentWindow: (name: string) => ChromeWindow;
    };
    focus: {
      activeWindow: ChromeWindow;
    };
    io: {
      newURI(url: string): nsIURI;
    },
    scriptSecurityManager: any;
    startup: {
      quit: (optionsBitmask: number) => void,
      eForceQuit: number,
      eRestart: number
    };
    scriptloader: {
      loadSubScript: (path: string, target: any) => any,
    }
  };

  const ServicesJSM: {
    Services: Services;
  };

  const EventEmitter: {
    decorate: (target: object) => void;
  };

  const ProfilerGetSymbolsJSM: {
    ProfilerGetSymbols: {
      getSymbolTable: (
        path: string,
        debugPath: string,
        breakpadId: string
      ) => any;
    };
  };

  const AppConstantsJSM: {
    AppConstants: {
      platform: string;
    };
  };

  const osfileJSM: {
    OS: {
      Path: {
        split: (
          path: string
        ) => {
          absolute: boolean;
          components: string[];
          winDrive?: string;
        };
        join: (...pathParts: string[]) => string;
      };
      File: {
        stat: (path: string) => Promise<{ isDir: boolean }>;
        Error: any;
      };
    };
  };

  interface BrowsingContextStub {}
  interface PrincipalStub {}

  interface WebChannelTarget {
    browsingContext: BrowsingContextStub,
    browser: Browser,
    eventTarget: null,
    principal: PrincipalStub,
  }

  const WebChannelJSM: any;

  // TS-TODO
  const CustomizableUIJSM: any;
  const CustomizableWidgetsJSM: any;
  const PanelMultiViewJSM: any;

  interface BrowserLoaderConfig {
    baseURI: string;
    window: Window;
  }
  const BrowserLoaderJS: {
    BrowserLoader: (config: BrowserLoaderConfig) => { require: (path: string) => any };
  }

  type LoaderJSM = {
    require: (path: string) => any;
  }
  const LoaderJSM: LoaderJSM;

  const Services: Services;

  // This class is needed by the Cc importing mechanism. e.g.
  // Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
  class nsIFilePicker {}

  interface FilePicker {
    init: (window: Window, title: string, mode: number) => void;
    open: (callback: (rv: number) => unknown) => void;
    // The following are enum values.
    modeGetFolder: number;
    returnOK: number;
    file: {
      path: string
    }
  }

  // This class is needed by the Cc importing mechanism. e.g.
  // Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
  class nsIEnvironment {}

  interface Environment {
    get(envName: string): string;
    set(envName: string, value: string): void;
  }

  const chrome: {
    Cc: {
      "@mozilla.org/process/environment;1": {
        getService(service: nsIEnvironment): Environment
      },
      "@mozilla.org/filepicker;1": {
        createInstance(instance: nsIFilePicker): FilePicker
      }
    },
    Ci: {
      nsIFilePicker: nsIFilePicker;
      nsIEnvironment: nsIEnvironment;
    },
  };

  namespace NavHistory {
    interface Entry {
      guid: string// e.g. "_uR1bHt2-8xE",
      url: URL,
      frecency: number // e.g. 11525,
      title: string // e.g. "Google"
    }

    type Getter = unknown;
    type Setter = unknown;
    type Value = unknown;
    type Function = unknown;
    type Interface = unknown;

    type ShutdownClient = {
      name: string,
      addBlocker: Function,
      removeBlocker: Function,
      jsclient: Interface,
      // more properties
    }

    interface DBConnection {
      defaultTransactionType: Value,
      variableLimit: Getter,
      transactionInProgress: Getter,
      asyncClose: Function,
      databaseFile: Getter,
      interrupt: Function,
      createAsyncStatement: Function,
      executeAsync: Function,
      // more
    }

    // toolkit/components/places/nsNavHistory.h
    // "@mozilla.org/browser/nav-history-service;1"
    interface NavHistoryService {
      fetch: (uriOrGuid: string) => Promise<null | NavHistory.Entry>;

      queryStringToQuery: Function;
      executeQuery: Function;
      addObserver: Function;
      shutdownClient: ShutdownClient;
      DBConnection: DBConnection;
      connectionShutdownClient: ShutdownClient;
      markPageAsTyped: Function;
      markPageAsFollowedLink: Function;
      getNewQuery: Function;
      getNewQueryOptions: Function;
      getObservers: Function;
      asyncExecuteLegacyQuery: Function;
      markPageAsFollowedBookmark: Function;
      QueryInterface: Function;
      canAddURI: Function;
      queryToQueryString: Function;
      removeObserver: Function;
      makeGuid: Function;
      hashURL: Function;
      recalculateOriginFrecencyStats: Function;
      decayFrecency: Function;
      databaseStatus: 0;
      DATABASE_STATUS_LOCKED: 4;
      DATABASE_STATUS_CREATE: 1;
      DATABASE_STATUS_CORRUPT: 2;
      historyDisabled: false;
      TRANSITION_FRAMED_LINK: 8;
      TRANSITION_LINK: 1;
      TRANSITION_TYPED: 2;
      TRANSITION_BOOKMARK: 3;
      TRANSITION_EMBED: 4;
      TRANSITION_REDIRECT_PERMANENT: 5;
      TRANSITION_REDIRECT_TEMPORARY: 6;
      TRANSITION_DOWNLOAD: 7;
      TRANSITION_RELOAD: 9;
      DATABASE_STATUS_OK: 0;
      DATABASE_STATUS_UPGRADED: 3
    }
  }

  // https://searchfox.org/mozilla-central/source/toolkit/modules/Sqlite.jsm
  interface ConnectionData {
    TRANSACTION_DEFAULT: string;
    TRANSACTION_DEFERRED: string;
    TRANSACTION_IMMEDIATE: string;
    TRANSACTION_EXCLUSIVE: string;
    unsafeRawConnection(...args: any): any;
    variableLimit(...args: any): any;
    getSchemaVersion(...args: any): any;
    setSchemaVersion(...args: any): any;
    close(...args: any): any;
    clone(...args: any): any;
    executeBeforeShutdown(...args: any): any;
    executeCached(...args: any): any;
    execute(sql: string, params?: Record<string, string> | null, onRow?: any | null): Promise<Row[]>;
    defaultTransactionType(...args: any): any;
    transactionInProgress(...args: any): any;
    executeTransaction(...args: any): any;
    tableExists(...args: any): any;
    indexExists(...args: any): any;
    shrinkMemory(...args: any): any;
    discardCachedStatements(...args: any): any;
    interrupt(...args: any): any;
  }

  interface Row {
    getTypeOfIndex(): any;
    getInt32(): any;
    getInt64(): any;
    getDouble(): any;
    getUTF8String(): any;
    getString(): any;
    getBlob(): any;
    getBlobAsString(): any;
    getBlobAsUTF8String(): any;
    getIsNull(): any;
    getResultByIndex(index: number): any;
    getResultByName(column: string): any;
    numEntries: number;
    VALUE_TYPE_NULL: number;
    VALUE_TYPE_INTEGER: number;
    VALUE_TYPE_FLOAT: number;
    VALUE_TYPE_TEXT: number;
    VALUE_TYPE_BLOB: number;
  }

  interface PlacesUtils {
    TYPE_X_MOZ_PLACE_CONTAINER: any;
    TYPE_X_MOZ_PLACE_SEPARATOR: any;
    TYPE_X_MOZ_PLACE: any;
    TYPE_X_MOZ_URL: any;
    TYPE_HTML: any;
    TYPE_UNICODE: any;
    TYPE_X_MOZ_PLACE_ACTION: any;
    LMANNO_FEEDURI: any;
    LMANNO_SITEURI: any;
    CHARSET_ANNO: any;
    MOBILE_ROOT_ANNO: any;
    TOPIC_SHUTDOWN: any;
    TOPIC_INIT_COMPLETE: any;
    TOPIC_DATABASE_LOCKED: any;
    TOPIC_EXPIRATION_FINISHED: any;
    TOPIC_FAVICONS_EXPIRED: any;
    TOPIC_VACUUM_STARTING: any;
    TOPIC_BOOKMARKS_RESTORE_BEGIN: any;
    TOPIC_BOOKMARKS_RESTORE_SUCCESS: any;
    TOPIC_BOOKMARKS_RESTORE_FAILED: any;
    observers: any;
    virtualAllBookmarksGuid: any;
    virtualHistoryGuid: any;
    virtualDownloadsGuid: any;
    virtualTagsGuid: any;
    isVirtualLeftPaneItem: any;
    asContainer: any;
    asQuery: any;
    endl: any;
    isValidGuid: any;
    isValidGuidPrefix: any;
    generateGuidWithPrefix: any;
    toURI: any;
    toPRTime: any;
    toDate: any;
    toISupportsString: any;
    getFormattedString: any;
    getString: any;
    parseActionUrl: any;
    isQueryGeneratedFolder: any;
    nodeIsFolder: any;
    nodeIsBookmark: any;
    nodeIsSeparator: any;
    nodeIsURI: any;
    nodeIsQuery: any;
    nodeAncestors: any;
    validateItemProperties: any;
    BOOKMARK_VALIDATORS: any;
    PAGEINFO_VALIDATORS: any;
    SYNC_BOOKMARK_VALIDATORS: any;
    SYNC_CHANGE_RECORD_VALIDATORS: any;
    QueryInterface: any;
    _shutdownFunctions: any;
    registerShutdownFunction: any;
    observe: any;
    nodeIsHost: any;
    nodeIsDay: any;
    nodeIsTagQuery: any;
    containerTypes: any;
    nodeIsContainer: any;
    nodeIsHistoryContainer: any;
    getConcreteItemId: any;
    getConcreteItemGuid: any;
    getReversedHost(host: {host: string}): string;
    wrapNode: any;
    unwrapNodes: any;
    validatePageInfo: any;
    normalizeToURLOrGUID: any;
    getFolderContents: any;
    bookmarksMenuFolderId: any;
    toolbarFolderId: any;
    isRootItem: any;
    getContainerNodeWithOptions: any;
    hasChildURIs: any;
    getChildCountForFolder: any;
    getURLsForContainerNode: any;
    promiseDBConnection(): Promise<ConnectionData>;
    promiseLargeCacheDBConnection: any;
    largeCacheDBConnDeferred: any;
    promiseUnsafeWritableDBConnection: any;
    withConnectionWrapper: any;
    promiseFaviconData: any;
    urlWithSizeRef: any;
    promiseItemGuid: any;
    promiseItemId: any;
    promiseManyItemIds: any;
    invalidateCachedGuidFor: any;
    invalidateCachedGuids: any;
    promiseBookmarksTree: any;
    chunkArray: any;
    sqlBindPlaceholders: any;
    md5: any;
    history: NavHistory.NavHistoryService
    favicons: any;
    bookmarks: any;
    tagging: any;
    instanceId: any;
    metadata: any;
    keywords: any;
    tagsFolderId: any;
    placesRootId: any;
  }

  const PlacesUtilsJSM: {
    PlacesUtils: PlacesUtils;
  }
}


// declare module "devtools/client/shared/vendor/react" {
//   import * as React from "react";
//   export = React;
// }

declare module "devtools/client/shared/vendor/react-dom-factories" {
  import * as ReactDomFactories from "react-dom-factories";
  export = ReactDomFactories;
}

declare module "devtools/client/shared/vendor/redux" {
  import * as Redux from "redux";
  export = Redux;
}

declare module "devtools/client/shared/vendor/react-redux" {
  import * as ReactRedux from "react-redux";
  export = ReactRedux;
}

declare module "devtools/shared/event-emitter2" {
  export = MockedExports.EventEmitter;
}

declare module "resource://gre/modules/Services.jsm" {
  export = MockedExports.ServicesJSM;
}

declare module "Services" {
  export = MockedExports.Services;
}

declare module "chrome" {
  export = MockedExports.chrome;
}

declare module "resource://gre/modules/osfile.jsm" {
  export = MockedExports.osfileJSM;
}

declare module "resource://gre/modules/AppConstants.jsm" {
  export = MockedExports.AppConstantsJSM;
}

declare module "resource://gre/modules/ProfilerGetSymbols.jsm" {
  export = MockedExports.ProfilerGetSymbolsJSM;
}

declare module "resource://gre/modules/WebChannel.jsm" {
  export = MockedExports.WebChannelJSM;
}


declare module "resource:///modules/CustomizableUI.jsm" {
  export = MockedExports.CustomizableUIJSM;
}

declare module "resource:///modules/CustomizableWidgets.jsm" {
  export = MockedExports.CustomizableWidgetsJSM;
}

declare module "resource:///modules/PanelMultiView.jsm" {
  export = MockedExports.PanelMultiViewJSM;
}

declare module "resource://devtools/shared/Loader.jsm" {
  export = MockedExports.LoaderJSM;
}

declare module "resource://devtools/shared/loader/browser-loader.js" {
  export = MockedExports.BrowserLoaderJS;
}

declare module "resource://gre/modules/PlacesUtils.jsm" {
  export = MockedExports.PlacesUtilsJSM;
}

declare var ChromeUtils: MockedExports.ChromeUtils;
declare var Cu: MockedExports.ChromeUtils;

/**
 * This is a variant on the normal Document, as it contains chrome-specific properties.
 */
declare interface ChromeDocument extends Document {
  /**
   * Create a XUL element of a specific type. Right now this function
   * only refines iframes, but more tags could be added.
   */
  createXULElement: ((type: "iframe") => XULIframeElement) &
    ((type: string) => XULElement);
}

/**
 * This is a variant on the HTMLElement, as it contains chrome-specific properties.
 */
declare interface ChromeHTMLElement extends HTMLElement {
  ownerDocument: ChromeDocument;
}

declare interface XULElement extends HTMLElement {
  ownerDocument: ChromeDocument;
}

declare interface XULIframeElement extends XULElement {
  contentWindow: ChromeWindow;
  src: string;
}

declare interface ChromeWindow extends Window {
  openWebLinkIn: (
    url: string,
    where: "current" | "tab" | "tabshifted" | "window" | "save",
    // TS-TODO
    params?: unknown
  ) => void;
  openTrustedLinkIn: (
    url: string,
    where: "current" | "tab" | "tabshifted" | "window" | "save",
    // TS-TODO
    params?: unknown
  ) => void;
}

declare interface MenuListElement extends XULElement {
  value: string;
  disabled: boolean;
}

declare interface XULCommandEvent extends Event {
  target: XULElement
}

declare interface XULElementWithCommandHandler {
  addEventListener: (type: "command", handler: (event: XULCommandEvent) => void, isCapture?: boolean) => void
  removeEventListener: (type: "command", handler: (event: XULCommandEvent) => void, isCapture?: boolean) => void
}
