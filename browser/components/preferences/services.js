/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from preferences.js */
/* import-globals-from sync.js */

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

XPCOMUtils.defineLazyPreferenceGetter(
  this,
  "FXA_ROOT_URL",
  "identity.fxaccounts.remote.root"
);
const FXA_SIGNUP_URL = new URL("/signup", FXA_ROOT_URL).href;

const workshopEnabled = Services.prefs.getBoolPref(
  "browser.pinebuild.workshop.enabled",
  false
);

const extraServices = [
  {
    type: "google-mozilla",
    nameId: "preferences-services-google-mozilla-account",
    labelsId: "preferences-services-google-labels",
    icon: "chrome://browser/content/companion/mozsocial.png",
  },
  {
    type: "google",
    nameId: "preferences-services-google-account",
    labelsId: "preferences-services-google-labels",
    icon: "chrome://browser/content/companion/googleAccount.png",
  },
  {
    type: "microsoft",
    nameId: "preferences-services-microsoft-account",
    labelsId: "preferences-services-microsoft-labels",
    icon: "chrome://browser/content/companion/microsoft365.ico",
  },
];

class ServiceRow extends HTMLElement {
  /**
   * Creates a <service-row> element for displaying service management data.
   *
   * @param {Object|null} service
   *        A connected service object. If null, then the user
   *        is not connected to one.
   * @param {Object}  data
   *        The data associated with the service the user wants to
   *        connect to / disconnect from.
   * @param {string}  data.type
   *        The type of service to display information for.
   * @param {string}  data.nameId
   *        Localization string for displaying the name of the service
   * @param {string}   data.labelsId
   *        Localization string for displaying a label for the service
   * @param {string}  data.icon
   *        The service icon
   */
  constructor(service, data) {
    super();
    this.service = service;
    this.data = data;
    // Firefox accounts don't have a listener
    if (this.service?.addListener) {
      let handleStatus = ({ status }) => this.setAttribute("status", status);
      this.service.addListener("status", handleStatus);
      window.addEventListener("unload", () => {
        this.service.removeListener("status", handleStatus);
      });
    }
  }

  static get observedAttributes() {
    return ["status"];
  }

  static get templateString() {
    return `
      <link rel="stylesheet" href="chrome://global/skin/in-content/common.css">
      <link rel="stylesheet" href="chrome://browser/skin/preferences/services.css"/>
      <div class="service-wrapper">
        <div class="service-info-container">
          <img class="service-icon"></img>
          <div class="service-info">
              <div class="service-name"></div>
              <div class="service-labels"></div>
          </div>
        </div>
        <div class="service-status">
          <div class="status-text" data-l10n-id="preferences-services-status"></div>
          <div class="status-text status-connected" data-l10n-id="preferences-services-connected-status" hidden></div>
          <div class="status-text status-connecting" data-l10n-id="preferences-services-connecting-status" hidden></div>
          <div class="status-text status-disconnected" data-l10n-id="preferences-services-disconnected-status" hidden></div>
          <div class="status-text status-error" data-l10n-id="preferences-services-error-status" hidden></div>
        </div>
        <button class="button-disconnect"
                data-l10n-id="preferences-services-disconnect-button"
                hidden></button>
        <button class="button-connect"
                data-l10n-id="preferences-services-connect-button"
                hidden></button>
      </div>
    `;
  }

  static get template() {
    if (this._template) {
      return this._template;
    }

    let parser = new DOMParser();
    let doc = parser.parseFromString(
      `<template id="service-template">${this.templateString}</template>`,
      "text/html"
    );
    this._template = document.importNode(
      doc.getElementById("service-template"),
      true
    );
    return this._template;
  }

  _getElement(selector) {
    return this.shadowRoot.querySelector(selector);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case "status":
        this.updateStatus(newValue);
    }
  }

  updateStatus(status) {
    let connected = status == "connected";
    let connecting = status == "connecting";
    let disconnected = status == "disconnected";
    let error = status == "error";

    let connectedStatus = this._getElement(".status-connected");
    let connectingStatus = this._getElement(".status-connecting");
    let disconnectedStatus = this._getElement(".status-disconnected");
    let errorStatus = this._getElement(".status-error");
    let disconnectButton = this._getElement(".button-disconnect");
    let connectButton = this._getElement(".button-connect");

    connectedStatus?.toggleAttribute("hidden", !connected);
    connectingStatus?.toggleAttribute("hidden", !connecting);
    disconnectedStatus?.toggleAttribute("hidden", !disconnected);
    errorStatus?.toggleAttribute("hidden", !error);

    connectButton?.toggleAttribute("hidden", connected || error);
    connectButton?.toggleAttribute("disabled", connecting);
    disconnectButton?.toggleAttribute("hidden", disconnected || connecting);
  }

  getServiceStatus() {
    let auth = this.service?.auth;
    if (!auth) {
      return "disconnected";
    }
    if (
      auth.accessToken &&
      new Date() < auth.tokenExpires &&
      !this.service.hasConnectionError
    ) {
      return "connected";
    }
    if (auth.refreshToken) {
      return "error";
    }
    return "disconnected";
  }

  connectedCallback() {
    if (this.shadowRoot) {
      return;
    }

    let shadowRoot = this.attachShadow({ mode: "open" });
    document.l10n.connectRoot(shadowRoot);
    shadowRoot.appendChild(this.constructor.template.content.cloneNode(true));

    this.render();
  }

  handleEvent(e) {
    switch (e.type) {
      case "click":
        if (e.target.classList.contains("button-disconnect")) {
          this.signout();
        } else if (e.target.classList.contains("button-connect")) {
          this.signin();
        }
    }
  }

  async signin() {
    this.service = await OnlineServices.createService(this.data.type);
    if (!this.service) {
      return;
    }
    this.setAttribute("status", "connected");
  }

  async signout() {
    await OnlineServices.deleteService(this.service);
    this.service = null;
    this.setAttribute("status", "disconnected");
  }

  render() {
    let wrapper = this._getElement(".service-wrapper");
    let icon = this._getElement(".service-icon");
    let name = this._getElement(".service-name");
    let labels = this._getElement(".service-labels");

    wrapper.setAttribute("type", this.data.type);
    icon.src = this.data.icon;
    document.l10n.setAttributes(name, this.data.nameId);
    document.l10n.setAttributes(labels, this.data.labelsId);

    let disconnectButton = this._getElement(".button-disconnect");
    let connectButton = this._getElement(".button-connect");
    disconnectButton.addEventListener("click", this);
    connectButton.addEventListener("click", this);

    this.setAttribute("status", this.getServiceStatus());
    this.setAttribute("service-type", this.data.type);
  }
}

customElements.define("service-row", ServiceRow);

class FxaServiceRow extends ServiceRow {
  constructor(service, data) {
    super(service, data);
  }

  getServiceStatus() {
    return this.service ? "connected" : "disconnected";
  }

  async signin() {
    // This will cause a location change to the FxA sign-in page. So there's no need
    // to trigger an attributeChanged callback here.
    gSyncPane.signIn();
  }

  async signout() {
    let confirmed = await gSyncPane.unlinkFirefoxAccount(true);
    if (confirmed) {
      this.service = null;
      this.setAttribute("status", "disconnected");
    }
  }

  updateStatus(status) {
    super.updateStatus(status);

    if (status !== "connected") {
      this.displaySignIn();
    }
  }

  async displayAccountData() {
    let name = this._getElement(".service-name");
    let labels = this._getElement(".service-labels");
    let icon = this._getElement(".service-icon");
    let signOutButton = this._getElement(".button-disconnect");

    name.removeAttribute("data-l10n-id");
    labels.removeAttribute("data-l10n-id");

    icon.src = this.service.avatar;
    let primaryLabel = document.createElement("strong");
    primaryLabel.textContent = this.service.displayName
      ? this.service.displayName
      : this.service.email;
    name.append(primaryLabel);
    if (this.service.displayName) {
      name.append(new Text(" "), new Text(this.service.email));
    }

    await fxAccounts.device.refreshDeviceList();
    document.l10n.setAttributes(labels, "preferences-services-devices-label", {
      deviceCount: fxAccounts.device.recentDeviceList.length,
    });
    document.l10n.setAttributes(
      signOutButton,
      "preferences-services-fxa-sign-out"
    );
  }

  displaySignIn() {
    let name = this._getElement(".service-name");
    let labels = this._getElement(".service-labels");
    let icon = this._getElement(".service-icon");
    icon.src = this.data.icon;

    document.l10n.setAttributes(name, this.data.nameId);
    document.l10n.setAttributes(labels, this.data.labelsId);
  }

  render() {
    let signInButton = this._getElement(".button-connect");
    let signOutButton = this._getElement(".button-disconnect");

    document.l10n.setAttributes(
      signOutButton,
      "preferences-services-fxa-sign-out"
    );

    document.l10n.setAttributes(
      signInButton,
      "preferences-services-fxa-sign-in"
    );

    super.render();

    if (this.getServiceStatus() === "connected") {
      this.displayAccountData();
    } else {
      this.displaySignIn();
    }
  }
}

customElements.define("fxa-service-row", FxaServiceRow);

function oauthObserver(subject, topic, data) {
  let serviceRow = document.querySelector(`service-row[service-type="${data}"`);
  if (!serviceRow) {
    return;
  }
  if (topic == "oauth-refresh-token-received") {
    serviceRow.setAttribute("status", "connecting");
  } else if (topic == "oauth-access-token-error") {
    serviceRow.setAttribute("status", "disconnected");
  }
}

function buildExtraServiceRows() {
  let extraServicesContainer = document.getElementById(
    "extra-services-container"
  );
  // we want to show different account options if using workshop backend
  if (workshopEnabled) {
    extraServicesContainer.append(
      document.createElement("workshop-services-list")
    );
  } else {
    let services = OnlineServices.getAllServices();
    let nodes = [];

    for (let serviceData of extraServices) {
      // Check if there is a connected account for a service.
      // TODO: This assumes a user only has 1 account of every service...
      let connectedService = services.find(s => s.app === serviceData.type);

      nodes.push(new ServiceRow(connectedService, serviceData));
    }

    extraServicesContainer.replaceChildren(...nodes);
  }

  Services.obs.addObserver(oauthObserver, "oauth-refresh-token-received");
  Services.obs.addObserver(oauthObserver, "oauth-access-token-error");
  window.addEventListener("unload", () => {
    Services.obs.removeObserver(oauthObserver, "oauth-refresh-token-received");
    Services.obs.removeObserver(oauthObserver, "oauth-access-token-error");
  });
}

async function buildFirefoxAccount() {
  let account = await fxAccounts.getSignedInUser();
  let firefoxAccountContainer = document.getElementById(
    "firefox-account-container"
  );
  let node = new FxaServiceRow(account, {
    type: "firefox-account",
    nameId: "preferences-services-firefox-account",
    labelsId: "preferences-services-firefox-account-labels",
    icon: "chrome://browser/content/companion/firefoxParentBrand.png",
  });

  firefoxAccountContainer.replaceChildren(node);
}
