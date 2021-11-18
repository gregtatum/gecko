/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MailAPIFactory } from "chrome://browser/content/companion/workshop-api-built.js";
import { ServiceUtils } from "chrome://browser/content/companion/service-utils.js";

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

    async getConnectedAccounts() {
      await workshopAPI.promisedLatestOnce("accountsLoaded");
      return this.connectedAccounts;
    },

    async connectAccount(type) {
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
  };
}

export { Workshop, workshopAPI, workshopEnabled };
