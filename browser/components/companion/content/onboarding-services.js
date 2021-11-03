/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "./widget-utils.js";
import { css, html, classMap } from "./lit.all.js";
import { ServiceUtils } from "./service-utils.js";

export class ServicesOnboarding extends MozLitElement {
  static get properties() {
    return {
      currentService: { type: String },
      authenticatingService: { type: String },
      recentlyAuthedServices: { type: Set },
    };
  }

  static get queries() {
    return {
      connectServiceElements: { all: "connect-service" },
    };
  }

  constructor() {
    super();
    this.recentlyAuthedServices = new Set();
    this.hideTimeouts = new Map();
    this.connectedServices = new Set();
    this.showConnectedMs = 10 * 1000;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("Companion:ViewLocation", this);
    window.addEventListener("Companion:SignIn", this);
    window.addEventListener("Companion:SignOut", this);
    this.setConnectedServices(window.CompanionUtils.connectedServices);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("Companion:ViewLocation", this);
    window.removeEventListener("Companion:SignIn", this);
    window.removeEventListener("Companion:SignOut", this);
    this.setConnectedServices([]);
  }

  handleEvent(e) {
    if (e.type == "Companion:ViewLocation") {
      this.onViewLocation(e);
    } else if (e.type == "Companion:SignIn") {
      this.onSignIn(e);
    } else if (e.type == "Companion:SignOut") {
      this.onSignOut(e);
    }
  }

  onViewLocation(e) {
    let oauthFlowService = e.detail.oauthFlowService;
    if (oauthFlowService) {
      this.currentService = this.normalizeServiceType(oauthFlowService);
      this.authenticatingService = this.currentService;
      this.dispatchOnUpdateComplete(
        new CustomEvent("service-onboarding-flow-handled", {
          detail: { service: oauthFlowService },
        })
      );
    } else {
      this.authenticatingService = null;
      let currentDomain = new URL(e.detail.url).host;
      this.currentService = ServiceUtils.getServiceForDomain(currentDomain);
      this.dispatchOnUpdateComplete(
        new CustomEvent("service-onboarding-url-handled", {
          detail: { domain: currentDomain },
        })
      );
    }
  }

  onSignIn(e) {
    let { service, connectedServices } = e.detail;
    this.setConnectedServices(connectedServices);
    this.showService(service);
  }

  onSignOut(e) {
    let { service, connectedServices } = e.detail;
    this.setConnectedServices(connectedServices);
    this.hideService(service);
  }

  showService(serviceType) {
    serviceType = this.normalizeServiceType(serviceType);
    this.recentlyAuthedServices.add(serviceType);
    this.requestUpdate();

    // Set a timeout to hide the "Connected" card at some point.
    this.hideTimeouts.set(
      serviceType,
      setTimeout(() => {
        this.hideService(serviceType);
        this.dispatchOnUpdateComplete(new Event("connected-hidden"));
      }, this.showConnectedMs)
    );
  }

  hideService(serviceType) {
    serviceType = this.normalizeServiceType(serviceType);
    this.recentlyAuthedServices.delete(serviceType);
    this.requestUpdate();

    // Clear any hide timeout that might exist, it's already hidden.
    let timeoutId = this.hideTimeouts.get(serviceType);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.hideTimeouts.delete(serviceType);
    }
  }

  setConnectedServices(serviceTypes) {
    this.connectedServices = new Set(
      serviceTypes.map(type => this.normalizeServiceType(type))
    );
  }

  normalizeServiceType(serviceType) {
    // With OnlineServices we have "google-mozilla" and "google". We want to
    // make sure that we treat them both as connected when one is connected.
    return serviceType.split("-")[0];
  }

  connectTemplate(serviceType) {
    serviceType = this.normalizeServiceType(serviceType);
    let service = ServiceUtils.getServiceByType(serviceType);
    if (!service) {
      Cu.reportError(new Error(`Can't find service "${serviceType}"`));
      return "";
    }
    let { icon, name, services, type } = service;
    let connected =
      this.connectedServices.has(type) || this.recentlyAuthedServices.has(type);
    return html`
      <connect-service
        .authenticating=${serviceType == this.authenticatingService}
        .connected=${connected}
        .icon=${icon}
        .name=${name}
        .services=${services}
        .type=${type}
      ></connect-service>
    `;
  }

  render() {
    let showServices = new Set([...this.recentlyAuthedServices]);
    if (
      this.currentService &&
      !this.connectedServices.has(this.currentService)
    ) {
      showServices.add(this.currentService);
    }
    let content = [...showServices].map(s => this.connectTemplate(s));
    return html`
      <div class="services-onboarding">
        ${content}
      </div>
    `;
  }
}
customElements.define("services-onboarding", ServicesOnboarding);

class ConnectService extends MozLitElement {
  static get properties() {
    return {
      authenticating: { type: Boolean },
      connected: { type: Boolean },
      icon: { type: String },
      name: { type: String },
      services: { type: String },
      type: { type: String },
    };
  }

  static get queries() {
    return {
      connectButton: ".connect-service-button",
    };
  }

  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");

      .card {
        box-shadow: 0 2px 6px 0 rgba(58, 57, 68, 0.2);
        padding: 16px;
        margin: 16px;
        border: none;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .connect-service-icon {
        width: 24px;
        height: 24px;
      }

      .connect-service-description {
        flex-grow: 1;
      }

      .connect-service-name {
        font-size: 1em;
        line-height: 1;
        margin: 0;
        margin-block-end: 8px;
      }

      .connect-service-services {
        font-size: 0.75em;
        color: var(--in-content-deemphasized-text);
        margin: 0;
      }

      .connect-service-button {
        /* flex for the green connected dot. */
        display: flex;
        align-items: baseline;
        gap: 4px;
        margin: 0;
        flex-shrink: 0;
      }

      .connect-service-button.connected::before {
        display: inline-block;
        content: "";
        padding: 2px;
        border-radius: 50%;
        background-color: #2ac3a2;
        height: 4px;
        width: 4px;
        flex-shrink: 0;
        flex-grow: 0;
      }
    `;
  }

  connectService() {
    if (!this.connected) {
      window.CompanionUtils.sendAsyncMessage("Companion:ConnectService", {
        type: this.type,
      });
    }
  }

  get connectButtonLabelId() {
    if (this.authenticating) {
      return "companion-onboarding-service-connecting";
    }
    if (this.connected) {
      return "companion-onboarding-service-connected";
    }
    return "companion-onboarding-service-connect";
  }

  render() {
    return html`
      <div class="card card-no-hover">
        <img class="connect-service-icon" src=${this.icon} />
        <div class="connect-service-description">
          <h2 class="connect-service-name">${this.name}</h2>
          <p class="connect-service-services">${this.services}</p>
        </div>
        <button
          class=${classMap({
            "connect-service-button": true,
            primary: !this.connected,
            connected: this.connected,
          })}
          ?disabled=${this.authenticating}
          @click=${this.connectService}
          data-l10n-id=${this.connectButtonLabelId}
        ></button>
      </div>
    `;
  }
}
customElements.define("connect-service", ConnectService);
