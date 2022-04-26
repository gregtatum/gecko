/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

var EXPORTED_SYMBOLS = ["WorkshopParentAccess"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

XPCOMUtils.defineLazyModuleGetters(this, {
  AsyncShutdown: "resource://gre/modules/AsyncShutdown.jsm",
});

const WorkshopParentAccess = {
  _initPromise: null,
  _serviceByAPI: {
    mapi: "microsoft",
    gapi: "google",
  },
  workshopEnabled: Services.prefs.getBoolPref(
    "browser.pinebuild.workshop.enabled",
    false
  ),
  workshopAPI: null,
  init() {
    if (!this._initPromise) {
      this._initPromise = this._initInternal();
    }
    return this._initPromise;
  },
  async _initInternal() {
    if (this.workshopEnabled && !this.workshopAPI) {
      // Keep a reference to `windowlessBrowser`. If it gets garbage collected
      // prematurely we can no longer communicate with the shared worker.
      this.windowlessBrowser = Services.appShell.createWindowlessBrowser(
        true,
        0
      );

      AsyncShutdown.profileBeforeChange.addBlocker(
        "WorkshopParentAccess: close windowless browser and drop reference",
        () => {
          this.windowlessBrowser.close();
          this.windowlessBrowser = null;
        }
      );

      const system = Services.scriptSecurityManager.getSystemPrincipal();
      const chromeShell = this.windowlessBrowser.docShell.QueryInterface(
        Ci.nsIWebNavigation
      );
      chromeShell.createAboutBlankContentViewer(system, system);

      const doc = chromeShell.document;
      const scriptElem = doc.createElement("script");
      scriptElem.setAttribute("type", "module");
      scriptElem.setAttribute(
        "src",
        "chrome://browser/content/companion/workshopAPIParentAccess.js"
      );
      doc.body.appendChild(scriptElem);
      const win = doc.defaultView;

      await new Promise(resolve => {
        win.addEventListener("workshopLoaded", resolve, { once: true });
      });

      this.workshopAPI = Cu.waiveXrays(win.WORKSHOP_API);
    }
  },
  /**
   * Get the workshop account of the given type.
   * @param {String} accountType
   * @returns A workshop account, or undefined if no account is found.
   */
  async getAccountByType(accountType) {
    await this.init();
    await this.workshopAPI.promisedLatestOnce("accountsLoaded");
    return this.workshopAPI.accounts?.items.find(
      account => this._serviceByAPI[account.type] === accountType
    );
  },
  /**
   * Determine if there is a connected account of the given type.
   * @param {String} accountType
   * @returns {boolean}
   */
  async hasConnectedAccount(accountType) {
    await this.init();
    const accounts = await this.getAccountByType(accountType);
    return !!accounts;
  },
  /**
   * Get the number of unread emails for the given account.
   * @param {String} accountType
   * @returns A positive integer or zero.
   */
  async getUnreadMessageCount(accountType) {
    await this.init();
    const account = await this.getAccountByType(accountType);
    const inboxSummaryFolder = account?.folders.getFirstFolderWithType(
      "inbox-summary"
    );
    return inboxSummaryFolder?.unreadMessageCount ?? 0;
  },

  /**
   * Get the web link for the inbox.
   * @param {String} accountType
   * @returns A string or null.
   */
  async getInboxUrl(accountType) {
    await this.init();
    const account = await this.getAccountByType(accountType);
    const inboxSummaryFolder = account?.folders.getFirstFolderWithType(
      "inbox-summary"
    );
    return inboxSummaryFolder?.webLink || null;
  },
};
