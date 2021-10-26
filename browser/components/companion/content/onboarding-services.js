/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "./widget-utils.js";
import { css, html, classMap } from "./lit.all.js";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const GOOGLE_SERVICE = {
  icon: "chrome://browser/content/companion/googleAccount.png",
  name: "Google Services",
  services: "Gmail, Calendar, Meet",
  domains: ["mail.google.com", "calendar.google.com", "meet.google.com"],
  type: "google",
};
const MICROSOFT_SERVICE = {
  icon: "chrome://browser/content/companion/microsoft365.ico",
  name: "Microsoft 365",
  services: "Outlook, Teams, OneDrive",
  domains: [
    "outlook.live.com",
    "login.live.com",
    "login.microsoftonline.com",
    "www.office.com",
  ],
  type: "microsoft",
};

const SERVICE_BY_DOMAIN = new Map();
const SERVICE_BY_TYPE = new Map();

function registerService(service) {
  SERVICE_BY_TYPE.set(service.type, service);
  for (let domain of service.domains) {
    SERVICE_BY_DOMAIN.set(domain, service.type);
  }
}

registerService(GOOGLE_SERVICE);
registerService(MICROSOFT_SERVICE);

export class ServicesOnboarding extends MozLitElement {
  static get properties() {
    return {
      currentService: { type: String },
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
    this.connectedServices = new Set(window.CompanionUtils.connectedServices);
    if (Cu.isInAutomation) {
      const testServices = JSON.parse(
        Services.prefs.getStringPref(
          "browser.pinebuild.companion.test-services",
          "[]"
        )
      );
      for (let service of testServices) {
        registerService(service);
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("Companion:ViewLocation", this);
    window.removeEventListener("Companion:SignIn", this);
    window.removeEventListener("Companion:SignOut", this);
    this.connectedServices = new Set();
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
    let currentDomain = new URL(e.detail.url).host;
    this.currentService = SERVICE_BY_DOMAIN.get(currentDomain);
    this.dispatchOnUpdateComplete(
      new CustomEvent("service-onboarding-url-handled", {
        detail: { domain: currentDomain },
      })
    );
  }

  onSignIn(e) {
    let { service, connectedServices } = e.detail;
    this.connectedServices = new Set(connectedServices);
    // The service could be something like "google-mozilla" or "microsoft-test".
    // Grab the service identifier without the extra parts.
    this.showService(service.split("-")[0]);
  }

  onSignOut(e) {
    let { service, connectedServices } = e.detail;
    this.connectedServices = new Set(connectedServices);
    this.hideService(service);
  }

  showService(serviceType) {
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
    this.recentlyAuthedServices.delete(serviceType);
    this.requestUpdate();

    // Clear any hide timeout that might exist, it's already hidden.
    let timeoutId = this.hideTimeouts.get(serviceType);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.hideTimeouts.delete(serviceType);
    }
  }

  connectTemplate(serviceType) {
    let { icon, name, services, type } = SERVICE_BY_TYPE.get(serviceType);
    let connected =
      this.connectedServices.has(type) || this.recentlyAuthedServices.has(type);
    return html`
      <connect-service
        .icon=${icon}
        .name=${name}
        .services=${services}
        .type=${type}
        .connected=${connected}
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
          @click=${this.connectService}
          data-l10n-id=${this.connected
            ? "companion-onboarding-service-connected"
            : "companion-onboarding-service-connect"}
        ></button>
      </div>
    `;
  }
}
customElements.define("connect-service", ConnectService);
