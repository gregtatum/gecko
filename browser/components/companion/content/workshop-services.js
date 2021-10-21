/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MailAPIFactory } from "chrome://browser/content/companion/workshop-api-built.js";
import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html, css } from "chrome://browser/content/companion/lit.all.js";

const OnlineServicesHelper = ChromeUtils.import(
  "resource:///modules/OnlineServicesHelper.jsm"
);

ChromeUtils.defineModuleGetter(
  globalThis,
  "OAuth2",
  "resource:///modules/OAuth2.jsm"
);

const workshopAPI = MailAPIFactory(OnlineServicesHelper);

const WORKSHOP_SERVICE_TYPES = ["google", "microsoft"];
const API_BY_SERVICE_TYPE = {
  google: "gapi",
  microsoft: "mapi",
};
const SERVICE_TYPE_BY_API = {
  gapi: "google",
  mapi: "microsoft",
};

export default class WorkshopServicesList extends MozLitElement {
  static get properties() {
    return {
      connectedServices: { type: Map },
    };
  }

  constructor() {
    super();
    this.connectedServices = new Map();
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("workshop-connect", this);
    this.addEventListener("workshop-disconnect", this);
    this.registerConnectedServices();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("workshop-connect", this);
    this.addEventListener("workshop-disconnect", this);
  }

  handleEvent(e) {
    if (e.type == "workshop-connect") {
      this.connectService(e.detail?.type);
    } else if (e.type == "workshop-disconnect") {
      this.disconnectService(e.detail.type);
    }
  }

  async registerConnectedServices() {
    let connectedServices = new Map();
    await workshopAPI.promisedLatestOnce("accountsLoaded");
    let workshopAccounts = workshopAPI.accounts?.items;
    if (workshopAccounts && workshopAccounts.length) {
      workshopAccounts.forEach(account => {
        connectedServices.set(SERVICE_TYPE_BY_API[account.type], account);
      });
    }
    this.connectedServices = connectedServices;
  }

  async connectService(type) {
    if (this.connectedServices.has(type)) {
      return null;
    }

    const oauthInfo = workshopAPI.oauthBindings[type];
    const authorizer = new OAuth2(
      oauthInfo.endpoint,
      oauthInfo.tokenEndpoint,
      oauthInfo.scopes?.join(" "),
      oauthInfo.clientId,
      oauthInfo.clientSecret,
      null
    );
    await authorizer.getToken();

    // The authorizer should now have accessToken, refreshToken, and
    // tokenExpires on it.
    const domainInfo = {
      type: API_BY_SERVICE_TYPE[type],
      oauth2Settings: {
        authEndpoint: oauthInfo.endpoint,
        tokenEndpoint: oauthInfo.tokenEndpoint,
        scope: oauthInfo.scopes.join(" "),
      },
      oauth2Secrets: {
        clientId: oauthInfo.clientId,
        clientSecret: oauthInfo.clientSecret,
      },
      oauth2Tokens: {
        refreshToken: authorizer.refreshToken,
        accessToken: oauthInfo.accessToken,
        expireTimeMS: oauthInfo.tokenExpires,
      },
    };

    let { account } = await workshopAPI.tryToCreateAccount({}, domainInfo);

    if (account) {
      this.connectedServices.set(type, account);
      this.requestUpdate();
    }

    return account;
  }

  disconnectService(type) {
    let account = this.connectedServices.get(type);
    account.deleteAccount();
    this.connectedServices.delete(type);
    this.requestUpdate();
  }

  render() {
    return WORKSHOP_SERVICE_TYPES.map(service => {
      let connected = this.connectedServices.has(service);
      return html`
        <workshop-service
          .type=${service}
          .connected=${connected}
        ></workshop-service>
      `;
    });
  }
}
customElements.define("workshop-services-list", WorkshopServicesList);

class WorkshopService extends MozLitElement {
  static get properties() {
    return {
      type: { type: String },
      connected: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");
      @import url("chrome://browser/skin/preferences/services.css");

      .service-name {
        text-transform: capitalize;
      }
    `;
  }

  connectService() {
    this.dispatchEvent(
      new CustomEvent("workshop-connect", {
        detail: { type: this.type },
        composed: true,
      })
    );
  }

  disconnectService() {
    this.dispatchEvent(
      new CustomEvent("workshop-disconnect", {
        detail: { type: this.type },
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="service-wrapper">
        <div class="service-info-container">
          <div class="service-info">
            <div class="service-name">${this.type}</div>
          </div>
        </div>
        <div class="service-status">
          <div
            class="status-text"
            data-l10n-id="preferences-services-status"
          ></div>
          <div
            ?hidden=${!this.connected}
            class="status-connected"
            data-l10n-id="preferences-services-connected-status"
          ></div>
          <div
            ?hidden=${this.connected}
            class="status-disconnected"
            data-l10n-id="preferences-services-disconnected-status"
          ></div>
        </div>
        <button
          ?hidden=${!this.connected}
          @click=${this.disconnectService}
          class="button-disconnect"
          data-l10n-id="preferences-services-disconnect-button"
          hidden
        ></button>
        <button
          ?hidden=${this.connected}
          @click=${this.connectService}
          class="button-connect"
          data-l10n-id="preferences-services-connect-button"
        ></button>
      </div>
    `;
  }
}
customElements.define("workshop-service", WorkshopService);
