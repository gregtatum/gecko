/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

const EMAIL_CHECK_TIME = 10 * 60 * 1000; // 10 minutes

export class Email extends HTMLElement {
  constructor(service, data) {
    super();
    this.data = data;
    this.service = service;

    this.className = "email card";

    let template = document.getElementById("template-email");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(
      ".subject"
    ).textContent = `${this.data.subject} (${this.data.from})`;

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
    // TODO: App bar uses this element but doesn't have a "service" right now
    if (!this.service) {
      return;
    }
    this.service.openEmail(this.data);
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
      // emails = await service.getUnreadEmailAtom();
      emails = await service.getUnreadEmail();
    } catch (e) {
      console.error(e);
      OnlineServices.deleteService(service);
      continue;
    }
    for (let email of emails) {
      allEmails.push(new Email(service, email));
    }

    goodService = true;
  }

  while (panel.firstChild) {
    panel.firstChild.remove();
  }

  if (!allEmails.length) {
    document.querySelector(".email-title").textContent = "No Unread emails";
  } else {
    document.querySelector(
      ".email-title"
    ).textContent = `Email (${allEmails.length})`;
    for (let email of allEmails) {
      panel.appendChild(email);
    }
  }

  if (!goodService) {
    document.getElementById("scroll").className = "disconnected";
  }
}

export function initEmailServices(services) {
  getEmail(services);
  setInterval(function() {
    getEmail(services);
  }, EMAIL_CHECK_TIME);
}
