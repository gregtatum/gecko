/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

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

    this._hasFormattedLinks = false;

    let template = document.getElementById("template-event");
    let fragment = template.content.cloneNode(true);

    this.data.start = new Date(Date.parse(this.data.start));
    this.data.end = new Date(Date.parse(this.data.end));

    let date = `${timeFormat.format(this.data.start)} - ${timeFormat.format(
      this.data.end
    )}`;

    fragment.querySelector(".date").textContent = date;
    fragment.querySelector(".summary").textContent = this.data.summary;

    fragment.querySelector(".event-info").addEventListener("click", event => {
      if (event.target.nodeName == "a") {
        window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
          url: event.target.getAttribute("link"),
        });
      } else {
        window.CompanionUtils.sendAsyncMessage("Companion:OpenCalendar", {
          start: this.data.start,
          serviceId: this.service,
        });
      }
    });
    let conferenceIcon = fragment.querySelector(".conference-icon");
    if (this.data.conference && this.data.conference.icon) {
      conferenceIcon.src = this.data.conference.icon;
      conferenceIcon.title = this.data.conference.name;
      conferenceIcon.addEventListener("click", () =>
        window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
          url: this.data.conference.url,
        })
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

  async formatLinks() {
    if (this._hasFormattedLinks) {
      return;
    }

    let formattedLinks = await Promise.all(
      this.data.links.map(async link => {
        return {
          url: link.url,
          text:
            link.text ||
            window.CompanionUtils.getPlacesData(link.url)?.title ||
            link.url,
        };
      })
    );

    for (let link of formattedLinks) {
      let div = document.createElement("div");
      let a = document.createElement("a");
      a.textContent = link.text;
      a.setAttribute("link", link.url);
      a.setAttribute("title", link.url);
      div.appendChild(a);
      this.querySelector(".links").appendChild(div);
    }
    this._hasFormattedLinks = true;
  }
}

customElements.define("e-event", Event);

async function updateEvents() {
  let visibleEventStart;
  let events = document.querySelectorAll("e-event");
  let now = new Date();
  let showCalendar = false;
  for (let event of events) {
    if (document.body.classList.contains("debugUI")) {
      event.hidden = false;
      showCalendar = true;
      continue;
    }
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

export async function buildEvents(events) {
  let panel = document.getElementById("calendar-panel");
  let nodes = [];
  for (let event of events) {
    nodes = nodes.concat(new Event(event.serviceId, event));
  }

  panel.replaceChildren(...nodes);
  updateEvents();
}

let calendarCheckTimer;
let calendarUpdateTimer;

export function initCalendarServices(events) {
  buildEvents(events);
  calendarCheckTimer = setInterval(function() {
    window.CompanionUtils.sendAsyncMessage("Companion:GetEvents", {});
  }, CALENDAR_CHECK_TIME);
  calendarUpdateTimer = setInterval(function() {
    updateEvents();
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
