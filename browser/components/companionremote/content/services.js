/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  initCalendarServices,
  uninitCalendarServices,
  buildEvents,
} from "./calendar.js";

export class Services extends HTMLElement {
  constructor() {
    super();
    this.className = "services";
    this._initialized = false;

    let template = document.getElementById("template-service-buttons");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);

    this.querySelector("#service-signin").addEventListener(
      "change",
      this.signin
    );
    this.querySelector("#service-signout").addEventListener(
      "click",
      this.signout
    );

    this.signInListener = () => {
      document.getElementById("service-login").className = "connected";
    };
  }

  connectedCallback() {
    window.addEventListener("Companion:RegisterEvents", this);
    window.addEventListener("Companion:ServiceDisconnected", this);
    window.addEventListener("Companion:SignedIn", this.signInListener);

    this.setConnectedState();
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:RegisterEvents", this);
    window.removeEventListener("Companion:ServiceDisconnected", this);
    window.removeEventListener("Companion:SignedIn", this.signInListener);
  }

  handleEvent(event) {
    switch (event.type) {
      case "Companion:ServiceDisconnected": {
        this.setConnectedState();
        break;
      }
      case "Companion:RegisterEvents": {
        let events = window.CompanionUtils.events;
        if (!this._initialized) {
          initCalendarServices(events);
          this._initialized = true;
        } else {
          buildEvents(events);
        }
        break;
      }
    }
  }

  setConnectedState() {
    if (window.CompanionUtils.servicesConnected) {
      document.getElementById("service-login").className = "connected";
    } else {
      document.getElementById("service-login").className = "disconnected";
    }
  }

  signin(event) {
    if (event.target.value) {
      window.CompanionUtils.sendAsyncMessage("Companion:SignIn", {
        service: event.target.value,
      });
    }
  }

  signout() {
    window.CompanionUtils.sendAsyncMessage("Companion:SignOut", {});
    uninitCalendarServices();
    this._initialized = false;
    document.getElementById("service-login").className = "disconnected";
  }
}

customElements.define("e-services", Services);
