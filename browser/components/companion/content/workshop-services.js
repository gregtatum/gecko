/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { workshopAPI } from "chrome://browser/content/companion/workshopAPI.js";
import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html, css } from "chrome://browser/content/companion/lit.all.js";
import { ServiceUtils } from "chrome://browser/content/companion/service-utils.js";

ChromeUtils.defineModuleGetter(
  globalThis,
  "OAuth2",
  "resource:///modules/OAuth2.jsm"
);

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
    this.removeEventListener("workshop-disconnect", this);
  }

  handleEvent(e) {
    if (e.type == "workshop-connect") {
      this.connectService(e.detail.type);
    } else if (e.type == "workshop-disconnect") {
      this.disconnectService(e.detail.type);
    }
  }

  async registerConnectedServices() {
    let connectedServices = new Map();
    await workshopAPI.promisedLatestOnce("accountsLoaded");
    let workshopAccounts = workshopAPI.accounts?.items;
    if (workshopAccounts?.length) {
      workshopAccounts.forEach(account => {
        let serviceType = ServiceUtils.getServiceByApi(account.type)?.type;
        connectedServices.set(serviceType, account);
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
    return Array.from(ServiceUtils.serviceByType.values()).map(service => {
      let connected = this.connectedServices.has(service.type);
      return html`
        <workshop-service
          .icon=${service.icon}
          .name=${service.name}
          .services=${service.services}
          .type=${service.type}
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
      connected: { type: Boolean },
      icon: { type: String },
      name: { type: String },
      services: { type: String },
      type: { type: String },
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
          <img class="service-icon" src=${this.icon}></img>
          <div class="service-info">
            <div class="service-name">${this.name}</div>
            <div class="service-labels">${this.services}</div>
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
