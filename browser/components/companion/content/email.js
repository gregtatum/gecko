/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { openUrl } from "./shared.js";

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

class Email extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;

    this.className = "email card";

    let template = document.getElementById("template-email");
    let fragment = template.content.cloneNode(true);

    fragment
      .querySelector(".favicon")
      .setAttribute("src", "chrome://browser/content/companion/email.svg");

    fragment.querySelector(".subject").textContent = this.data.subject;

    let date = new Date(this.data.date);
    let today = new Date();
    if (
      date.getDate() == today.getDate() &&
      date.getMonth() == today.getMonth() &&
      date.getFullYear() == today.getFullYear()
    ) {
      fragment.querySelector(".date").textContent = date.toLocaleTimeString(
        [],
        { hour: "2-digit", minute: "2-digit" }
      );
    } else {
      fragment.querySelector(".date").textContent = date.toLocaleDateString(
        [],
        { month: "short", day: "numeric" }
      );
    }

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  handleEvent(event) {
    openUrl("https://mail.google.com/mail/#inbox/" + this.data.id);
    setTimeout(function() {
      let services = OnlineServices.getServices();
      getEmail(services);
    }, 5000);
  }
}

customElements.define("e-email", Email);

async function getEmail(services) {
  let panel = document.getElementById("email-panel");

  let allEmails = [];

  let goodService = false;
  for (let service of services) {
    let emails;
    try {
      emails = await service.getUnreadEmail();
    } catch (e) {
      console.error(e);
      OnlineServices.deleteService(service);
      continue;
    }
    allEmails = allEmails.concat(emails);

    goodService = true;
  }

  while (panel.firstChild) {
    panel.firstChild.remove();
  }

  for (let email of allEmails) {
    panel.appendChild(new Email(email));
  }

  if (!goodService) {
    document.getElementById("services").className = "disconnected";
  }
}

export function initEmailServices(services) {
  getEmail(services);
}
