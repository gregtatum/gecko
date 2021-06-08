/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { openUrl, timeFormat, getPlacesData } from "./shared.js";

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

// Query new events every fifteen minutes
const CALENDAR_CHECK_TIME = 15 * 60 * 1000; // 15 minutes
// Update display every minute
const CALENDAR_UPDATE_TIME = 60 * 1000; // 1 minute
// Number of minutes after start that an event is hidden
const MEETING_HIDE_DELAY = 10;

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

    fragment.querySelector(".event-info").addEventListener("click", event => {
      if (event.target.nodeName == "a") {
        openUrl(event.target.href);
      } else {
        this.openCalendar();
      }
    });
    let conferenceIcon = fragment.querySelector(".conference-icon");
    if (this.data.conference && this.data.conference.icon) {
      conferenceIcon.src = this.data.conference.icon;
      conferenceIcon.title = this.data.conference.name;
      conferenceIcon.addEventListener("click", () =>
        openUrl(this.data.conference.url)
      );
    } else {
      conferenceIcon.style.display = "none";
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

  async connectedCallback() {
    let formattedLinks = await Promise.all(
      this.data.links.map(async link => {
        return {
          url: link.url,
          text: link.text || (await getPlacesData(link.url))?.title || link.url,
        };
      })
    );

    for (let link of formattedLinks) {
      let div = document.createElement("div");
      let a = document.createElement("a");
      a.textContent = link.text;
      a.setAttribute("href", link.url);
      div.appendChild(a);
      this.querySelector(".links").appendChild(div);
    }
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
  let showCalendar = false;
  for (let event of events) {
    if (event.data.end < now) {
      // Never show meetings that have happened
      event.hidden = true;
    } else if (now >= event.data.start) {
      // Show meetings that have started until MEETING_HIDE_DELAY
      let startPlusXMinutes = new Date(event.data.start.getTime());
      startPlusXMinutes.setMinutes(
        startPlusXMinutes.getMinutes() + MEETING_HIDE_DELAY
      );
      event.hidden = now > startPlusXMinutes;
    } else if (visibleEventStart) {
      // Show the next upcoming meeting and any other
      // meetings that start at the same time.
      event.hidden = event.data.start > visibleEventStart;
    } else {
      visibleEventStart = event.data.start;
      event.hidden = false;
    }
    if (event.hidden === false) {
      showCalendar = true;
    }
  }
  document.querySelector("#calendar").hidden = !showCalendar;
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

  panel.replaceChildren(...nodes);
  updateEvents();
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
