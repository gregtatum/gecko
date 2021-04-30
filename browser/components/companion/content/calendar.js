/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { openUrl, timeFormat } from "./shared.js";

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

// Query new events every fifteen minutes
const CALENDAR_CHECK_TIME = 15 * 60 * 1000; // 15 minutes
// Update display every minute
const CALENDAR_UPDATE_TIME = 60 * 1000; // 1 minute

class Event extends HTMLElement {
  constructor(service, data) {
    super();
    this.service = service;
    this.data = data;

    this.className = "event card";

    let template = document.getElementById("template-event");
    let fragment = template.content.cloneNode(true);

    let date = `${timeFormat.format(this.data.start)} - ${timeFormat.format(
      this.data.end
    )}`;

    fragment.querySelector(".date").textContent = date;
    fragment.querySelector(".summary").textContent = this.data.summary;

    fragment
      .querySelector(".event-info")
      .addEventListener("click", () => this.openCalendar());

    if (this.data.conference) {
      if (this.data.conference.icon) {
        fragment.querySelector(
          ".conference-icon"
        ).src = this.data.conference.icon;
      }
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

    /*
    // TODO!!!!!
    // THIS WILL NOT WORK WITH MORE THAN ONE EVENT OR MORE THAN ONE PROVIDER!!!!
    let rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

    let today = new Date();
    let event = this.data.start;
    let options = { year: "numeric", month: "long", day: "numeric" };
    let formattedEventDate = event.toLocaleDateString("en-US", options);
    if (
      today.getDate() == event.getDate() &&
      today.getMonth() == event.getMonth() &&
      today.getFullYear == event.getFullYear()
    ) {
      document.querySelector(".calendar-title").textContent =
        rtf.format(0, "day") + " " + formattedEventDate;
    } else {
      let midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      let daysApart = Math.ceil(
        (event.getTime() - midnight.getTime()) / (1000 * 3600 * 24)
      );
      document.querySelector(".calendar-title").textContent =
        rtf.format(daysApart, "day") + " " + formattedEventDate;
    }
*/
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

async function updateEvents() {
  let visibleEventStart;
  let events = document.querySelectorAll("e-event");
  let now = new Date();
  for (let event of events) {
    // Never show meetings that have happened
    if (event.data.end < now) {
      event.hidden = true;
      continue;
    }
    // Always show meetings that are happening
    if (now >= event.data.start && now < event.data.end) {
      event.hidden = false;
      continue;
    }

    // Show the next upcoming meeting and any other
    // meetings that start at the same time.
    if (visibleEventStart) {
      event.hidden = event.data.start > visibleEventStart;
    } else {
      visibleEventStart = event.data.start;
      event.hidden = false;
    }
  }
}

async function buildEvents(services) {
  let panel = document.getElementById("calendar-panel");
  let nodes = [];

  for (let service of services) {
    let meetings;
    try {
      meetings = await service.getNextMeetings();
    } catch (e) {
      console.error(e);
      OnlineServices.deleteService(service);
      continue;
    }

    nodes = nodes.concat(meetings.map(event => new Event(service, event)));
  }

  if (!nodes.length) {
    document.querySelector("#calendar").hidden = true;
  } else {
    document.querySelector("#calendar").hidden = false;
    panel.replaceChildren(...nodes);
    updateEvents();
  }
}

let calendarCheckTimer;
let calendarUpdateTimer;

export function initCalendarServices(services) {
  buildEvents(services);
  calendarCheckTimer = setInterval(function() {
    buildEvents(services);
  }, CALENDAR_CHECK_TIME);
  calendarUpdateTimer = setInterval(function() {
    updateEvents(services);
  }, CALENDAR_UPDATE_TIME);
}

export function uninitCalendarServices(services) {
  if (calendarCheckTimer) {
    clearInterval(calendarCheckTimer);
    calendarCheckTimer = 0;
  }
  if (calendarUpdateTimer) {
    clearInterval(calendarUpdateTimer);
    calendarUpdateTimer = 0;
  }
  let panel = document.getElementById("calendar-panel");
  panel.replaceChildren([]);
  document.querySelector("#calendar").hidden = true;
}
