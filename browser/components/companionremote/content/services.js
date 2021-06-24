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
    this._hasServices = this._initialized = false;

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
    window.addEventListener("Companion:SignedIn", this.signInListener);

    if (window.CompanionUtils.servicesConnected) {
      document.getElementById("service-login").className = "connected";
      this._hasServices = true;
    } else {
      document.getElementById("service-login").className = "disconnected";
    }
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:RegisterEvents", this);
    window.removeEventListener("Companion:SignedIn", this.signInListener);
  }

  handleEvent(event) {
    switch (event.type) {
      case "Companion:RegisterEvents": {
        let events = window.CompanionUtils.events;
        if (this._hasServices && !this._initialized) {
          initCalendarServices(events);
          this._initialized = true;
        } else if (this._hasServices) {
          buildEvents(events);
        }
        break;
      }
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
    document.getElementById("service-login").className = "disconnected";
  }
}

customElements.define("e-services", Services);
