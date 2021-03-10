/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { openUrl, tomorrow, dateFormat, timeFormat } from "./shared.js";

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

class Event extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;
  }

  connectedCallback() {
    this.className = "event card";

    let template = document.getElementById("template-event");
    let fragment = template.content.cloneNode(true);

    let date =
      this.data.start > tomorrow
        ? dateFormat.format(this.data.start)
        : timeFormat.format(this.data.start);

    fragment
      .querySelector(".favicon")
      .setAttribute("src", "chrome://browser/content/companion/event.svg");
    fragment.querySelector(".date").textContent = date;
    fragment.querySelector(".summary").textContent = this.data.summary;

    if (this.data.conference) {
      fragment.querySelector(
        ".conference-icon"
      ).src = this.data.conference.icon;
      fragment.querySelector(
        ".conference-label"
      ).textContent = this.data.conference.name;
    } else {
      fragment.querySelector(".conference").style.display = "none";
    }

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  handleEvent(event) {
    openUrl(this.data.conference.url);
  }
}

customElements.define("e-event", Event);

async function buildEvents(services) {
  let panel = document.getElementById("service-panel");
  while (panel.firstChild) {
    panel.firstChild.remove();
  }

  for (let service of services) {
    for (let event of await service.getNextMeetings()) {
      panel.appendChild(new Event(event));
    }
  }
}

async function signin() {
  await OnlineServices.createService(
    Services.prefs.getCharPref("onlineservices.defaultType", "google")
  );
  document.getElementById("services").className = "connected";
  buildEvents(OnlineServices.getServices());
  window.focus();
}

export function initServices() {
  document.getElementById("service-signin").addEventListener("click", signin);

  let services = OnlineServices.getServices();
  if (services.length) {
    document.getElementById("services").className = "connected";
    buildEvents(services);
  } else {
    document.getElementById("services").className = "disconnected";
  }
}
