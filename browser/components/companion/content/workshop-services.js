/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

import {
  Workshop,
  workshopAPI,
} from "chrome://browser/content/companion/workshopAPI.js";
import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html, css } from "chrome://browser/content/companion/lit.all.js";
import { ServiceUtils } from "chrome://browser/content/companion/service-utils.js";

export default class WorkshopServicesList extends MozLitElement {
  static get properties() {
    return {
      connectedServices: { type: Map },
      connectingServices: { type: Set },
    };
  }

  constructor() {
    super();
    this.connectedServices = new Map();
    this.connectingServices = new Set();
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("workshop-connect", this);
    this.addEventListener("workshop-disconnect", this);
    let _observe = this.observe.bind(this);
    Services.obs.addObserver(_observe, "oauth-refresh-token-received");
    Services.obs.addObserver(_observe, "oauth-access-token-error");
    window.addEventListener("unload", () => {
      Services.obs.removeObserver(_observe, "oauth-refresh-token-received");
      Services.obs.removeObserver(_observe, "oauth-access-token-error");
    });
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

  observe(subject, topic, data) {
    if (topic == "oauth-refresh-token-received") {
      this.connectingServices.add(data);
      this.requestUpdate();
    } else if (topic == "oauth-access-token-error") {
      this.connectingServices.delete(data);
      this.requestUpdate();
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
    let account = await Workshop.connectAccount(type);
    if (account) {
      this.connectedServices.set(type, account);
      this.requestUpdate();
    }
    return account;
  }

  disconnectService(type) {
    let account = this.connectedServices.get(type);
    Workshop.deleteAccount(account);
    this.connectedServices.delete(type);
    this.requestUpdate();
  }

  render() {
    return Array.from(ServiceUtils.serviceByType.values()).map(service => {
      let status;
      if (this.connectedServices.has(service.type)) {
        status = "connected";
      } else if (this.connectingServices.has(service.type)) {
        status = "connecting";
      } else {
        status = "disconnected";
      }
      return html`
        <workshop-service
          .icon=${service.icon}
          .name=${service.name}
          .services=${service.services}
          .type=${service.type}
          .status=${status}
        ></workshop-service>
      `;
    });
  }
}
customElements.define("workshop-services-list", WorkshopServicesList);

class WorkshopService extends MozLitElement {
  static get properties() {
    return {
      status: { type: String },
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

  get connected() {
    return this.status == "connected";
  }

  get connecting() {
    return this.status == "connecting";
  }

  get disconnected() {
    return !this.connected;
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
            class=${`status-text status-${this.status}`}
            data-l10n-id=${`preferences-services-${this.status}-status`}
          ></div>
        </div>
        <button
          ?hidden=${this.disconnected}
          @click=${this.disconnectService}
          class="button-disconnect"
          data-l10n-id="preferences-services-disconnect-button"
          hidden
        ></button>
        <button
          ?hidden=${this.connected}
          ?disabled=${this.connecting}
          @click=${this.connectService}
          class="button-connect"
          data-l10n-id="preferences-services-connect-button"
        ></button>
      </div>
    `;
  }
}
customElements.define("workshop-service", WorkshopService);
