/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  MailAPIFactory,
  setExtendedTimeout,
} from "chrome://browser/content/companion/workshop-api-built.js";
import { ServiceUtils } from "./service-utils.js";

const OnlineServicesHelper = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

let workshopAPI = null;
let Workshop = null;
let workshopEnabled = Services.prefs.getBoolPref(
  "browser.pinebuild.workshop.enabled"
);

if (workshopEnabled) {
  const mainThreadServices = OnlineServicesHelper.MainThreadServices(window);
  workshopAPI = MailAPIFactory(mainThreadServices);
  // Let mainThreadServices know about the workshopAPI obj
  // so that we can properly handle "beforeunload" events.
  mainThreadServices.registerWorkshopAPI(workshopAPI);

  Workshop = {
    _calendarListView: null,
    _workshopAccountCache: new Map(),
    get connectedAccounts() {
      let workshopAccounts = workshopAPI.accounts?.items;
      if (workshopAccounts?.length) {
        return workshopAccounts.map(account => {
          let config = ServiceUtils.getServiceByApi(account.type);
          return config?.type;
        });
      }
      return [];
    },

    getAccountByType(accountType) {
      let workshopAccount = this._workshopAccountCache.get(accountType);
      if (workshopAccount) {
        return workshopAccount;
      }
      workshopAccount = workshopAPI.accounts?.items.find(
        account =>
          ServiceUtils.getServiceByApi(account.type)?.type === accountType
      );

      if (workshopAccount) {
        this._workshopAccountCache.set(accountType, workshopAccount);
      }
      return workshopAccount;
    },

    async getConnectedAccounts() {
      await workshopAPI.promisedLatestOnce("accountsLoaded");
      return this.connectedAccounts;
    },

    async hasConnectedAccountType(type) {
      const connectedAccounts = await this.getConnectedAccounts();
      return connectedAccounts.includes(type);
    },

    async assertNoAccountOfType(type) {
      if (await this.hasConnectedAccountType(type)) {
        throw new Error(`Account of type "${type}" already connected`);
      }
    },

    async connectAccount(type) {
      // Ensure this account type doesn't exist before prompting for log in.
      await this.assertNoAccountOfType(type);

      const oauthInfo = workshopAPI.oauthBindings[type];
      let oauth2Tokens = await this.companionActor.sendQuery(
        "Companion:GetOAuth2Tokens",
        {
          endpoint: oauthInfo.endpoint,
          tokenEndpoint: oauthInfo.tokenEndpoint,
          scopes: oauthInfo.scopes?.join(" "),
          clientId: oauthInfo.clientId,
          clientSecret: oauthInfo.clientSecret,
          type,
        }
      );

      // If more than one login was started prior to one completing, there could
      // now be an account of this type. Abort if that's the case.
      await this.assertNoAccountOfType(type);

      // The authorizer should now have accessToken, refreshToken, and
      // tokenExpires on it.
      const domainInfo = {
        type: ServiceUtils.getServiceByType(type)?.api,
        oauth2Settings: {
          authEndpoint: oauthInfo.endpoint,
          tokenEndpoint: oauthInfo.tokenEndpoint,
          scope: oauthInfo.scopes.join(" "),
        },
        oauth2Secrets: {
          clientId: oauthInfo.clientId,
          clientSecret: oauthInfo.clientSecret,
        },
        oauth2Tokens,
      };

      let { account } = await workshopAPI.tryToCreateAccount({}, domainInfo);

      if (account) {
        // Wait to be sure we've the folders before starting to refresh the
        // contents of those folders (else we need to wait for the next refresh).
        await account.syncFolderList();
        this.companionActor.sendAsyncMessage("Companion:AccountCreated", {
          type,
        });
      }

      return account;
    },

    async deleteAccount(account) {
      await account.deleteAccount();
      let type = ServiceUtils.getServiceByApi(account.type)?.type;
      this.companionActor.sendAsyncMessage("Companion:AccountDeleted", {
        type,
      });
    },

    get companionActor() {
      return window.windowGlobalChild.getActor("Companion");
    },

    getCalendarEventQuery(filterConfig = {}) {
      return {
        kind: "calendar",
        filter: {
          tag: "",
          event: {
            type: "now",
            durationBeforeInMinutes: 60,
          },
          ...filterConfig,
        },
      };
    },

    createCalendarListView() {
      const spec = this.getCalendarEventQuery();
      let listView = workshopAPI.searchAllMessages(spec);
      listView.refresh();
      return listView;
    },

    createBrowseListView() {
      const spec = {
        kind: "calendar",
        filter: {
          tag: "",
          event: {
            type: "browse",
            durationBeforeInMinutes: 15,
          },
        },
      };
      let listView = workshopAPI.searchAllMessages(spec);
      listView.refresh();
      return listView;
    },

    async refreshServices() {
      const spec = this.getCalendarEventQuery();
      await workshopAPI.refreshAllFoldersList(spec);
      return workshopAPI.refreshAllMessages(spec);
    },

    /**
     * Get the number of unread emails for the given account.
     * @param {String} accountType
     * @returns A positive integer or zero if the value exists or -1.
     */
    getUnreadMessageCount(accountType) {
      const account = this.getAccountByType(accountType);
      const inboxSummaryFolder = account?.folders.getFirstFolderWithType(
        "inbox-summary"
      );
      return inboxSummaryFolder?.unreadMessageCount ?? -1;
    },

    /**
     * Get the web link for the inbox.
     * @param {String} accountType
     * @returns A string or null.
     */
    getInboxUrl(accountType) {
      const account = this.getAccountByType(accountType);
      const inboxSummaryFolder = account?.folders.getFirstFolderWithType(
        "inbox-summary"
      );
      return inboxSummaryFolder?.webLink || null;
    },
  };
}

export { setExtendedTimeout, Workshop, workshopAPI, workshopEnabled };
