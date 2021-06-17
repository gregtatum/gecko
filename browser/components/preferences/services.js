/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from sync.js */

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

const extraServices = [
  {
    type: "google-mozilla",
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
   *        A connected service object managed by OnlineServices. If null, then the user
   *        is not connected to one.
   * @param {Object}  data
   *        The data associated with the service the user wants to
   *        connect to / disconnect from.
   * @param {string}  data.type
   *        The type of service to display information for.
   * @param {string}  data.title
   *        The name of the service.
   * @param {Array}   data.apps
   *        The list of apps the service integrates with.
   * @param {string}  data.icon
   *        The service icon
   */
  constructor(service, data) {
    super();
    this.service = service;
    this.data = data;
  }

  static get observedAttributes() {
    return ["connected"];
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
          <div class="status-connected" data-l10n-id="preferences-services-connected-status" hidden></div>
          <div class="status-disconnected" data-l10n-id="preferences-services-disconnected-status" hidden></div>
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

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case "connected":
        this.updateStatus(newValue);
    }
  }

  updateStatus(connected) {
    connected = connected == "true";

    let statusContainer = this.shadowRoot.querySelector(".service-status");
    let connectedStatus = this.shadowRoot.querySelector(".status-connected");
    let disconnectedStatus = this.shadowRoot.querySelector(
      ".status-disconnected"
    );

    let disconnectButton = this.shadowRoot.querySelector(".button-disconnect");
    let connectButton = this.shadowRoot.querySelector(".button-connect");

    statusContainer.toggleAttribute(
      "hidden",
      this.data.type == "firefox-account"
    );
    connectedStatus.toggleAttribute("hidden", !connected);
    disconnectButton.toggleAttribute("hidden", !connected);
    disconnectedStatus.toggleAttribute("hidden", connected);
    connectButton.toggleAttribute("hidden", connected);
  }

  getIsServiceConnected() {
    if (this.data.type == "firefox-account") {
      return !!this.service;
    }

    return !!this.service?.auth?.accessToken;
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
    if (this.data.type == "firefox-account") {
      await gSyncPane.signIn();
    } else {
      await OnlineServices.createService(this.data.type);
      // TODO: initialize calendar and email services
      this.service = OnlineServices.getServices().find(
        ({ app }) => app === this.data.type
      );
    }

    this.setAttribute("connected", true);
  }

  async signout() {
    await OnlineServices.deleteService(this.service);
    // TODO: uninitialize calendar and email services
    this.service = null;
    this.setAttribute("connected", false);
  }

  render() {
    let wrapper = this.shadowRoot.querySelector(".service-wrapper");
    let icon = this.shadowRoot.querySelector(".service-icon");
    let name = this.shadowRoot.querySelector(".service-name");
    let labels = this.shadowRoot.querySelector(".service-labels");

    wrapper.setAttribute("type", this.data.type);
    icon.src = this.data.icon;
    document.l10n.setAttributes(name, this.data.nameId);
    document.l10n.setAttributes(labels, this.data.labelsId);

    let disconnectButton = this.shadowRoot.querySelector(".button-disconnect");
    let connectButton = this.shadowRoot.querySelector(".button-connect");
    disconnectButton.addEventListener("click", this);
    connectButton.addEventListener("click", this);

    this.setAttribute("connected", this.getIsServiceConnected());
  }
}

customElements.define("service-row", ServiceRow);

function buildExtraServiceRows() {
  let extraServicesContainer = document.getElementById(
    "extra-services-container"
  );
  let services = OnlineServices.getServices();
  let nodes = [];

  for (let serviceData of extraServices) {
    // Check if there is a connected account for a service.
    // TODO: This assumes a user only has 1 account of every service...
    let connectedService = services.find(s =>
      s.app.startsWith(serviceData.type)
    );

    nodes.push(new ServiceRow(connectedService, serviceData));
  }

  extraServicesContainer.replaceChildren(...nodes);
}

async function buildFirefoxAccount() {
  let account = await fxAccounts.getSignedInUser();

  if (account) {
    showConnectedFxaAccount(account);
  } else {
    showDisconnectedFxaAccount();
  }
}

function showDisconnectedFxaAccount() {
  let firefoxAccountContainer = document.getElementById(
    "firefox-account-container"
  );
  let node = new ServiceRow(null, {
    type: "firefox-account",
    nameId: "preferences-services-firefox-account",
    labelsId: "preferences-services-firefox-account-labels",
    icon: "chrome://browser/content/companion/firefoxParentBrand.png",
  });

  firefoxAccountContainer.replaceChildren(node);
}

function showConnectedFxaAccount(account) {
  let firefoxAccountContainer = document.getElementById(
    "firefox-account-container"
  );
  let fxaGroup = document.getElementById("fxaGroup");
  let clone = fxaGroup.cloneNode(true);
  firefoxAccountContainer.appendChild(clone);

  let signoutButton = firefoxAccountContainer.querySelector("#fxaUnlinkButton");
  signoutButton.addEventListener("command", e => {
    gSyncPane.unlinkFirefoxAccount(true).then(confirmed => {
      if (confirmed) {
        showDisconnectedFxaAccount();
      }
    });
  });

  firefoxAccountContainer.replaceChildren(clone);
}
