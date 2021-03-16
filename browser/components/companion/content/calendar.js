/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { openUrl, tomorrow, dateFormat, timeFormat } from "./shared.js";

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

const CALENDAR_CHECK_TIME = 10 * 60 * 1000; // 5 minutes

class Event extends HTMLElement {
  constructor(service, data) {
    super();
    this.service = service;
    this.data = data;

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

    fragment
      .querySelector(".event-info")
      .addEventListener("click", () => this.openCalendar());

    if (this.data.conference) {
      fragment.querySelector(
        ".conference-icon"
      ).src = this.data.conference.icon;
      fragment.querySelector(
        ".conference-label"
      ).textContent = this.data.conference.name;

      fragment
        .querySelector(".conference")
        .addEventListener("click", () => openUrl(this.data.conference.url));
    } else {
      fragment.querySelector(".conference").style.display = "none";
    }

    this.appendChild(fragment);
  }

  openCalendar() {
    this.service.openCalendar(
      this.data.start.getFullYear(),
      this.data.start.getMonth() + 1,
      this.data.start.getDate()
    );
  }
}

customElements.define("e-event", Event);

async function buildEvents(services) {
  let panel = document.getElementById("calendar-panel");
  let nodes = [];

  let goodService = false;
  for (let service of services) {
    let meetings;
    try {
      meetings = await service.getNextMeetings();
    } catch (e) {
      console.error(e);
      OnlineServices.deleteService(service);
      continue;
    }

    goodService = true;

    nodes = nodes.concat(meetings.map(event => new Event(service, event)));
  }

  panel.replaceChildren(...nodes);

  if (!goodService) {
    document.getElementById("scroll").className = "disconnected";
  }
}

export function initCalendarServices(services) {
  buildEvents(services);
  setInterval(function() {
    buildEvents(services);
  }, CALENDAR_CHECK_TIME);
}
