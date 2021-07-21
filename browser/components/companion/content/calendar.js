/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, css, openLink, MozLitElement } from "./widget-utils.js";

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

// Query new events every five minutes
const CALENDAR_CHECK_TIME = 5 * 60 * 1000; // 5 minutes
// Update display every minute
const CALENDAR_UPDATE_TIME = 60 * 1000; // 1 minute

setInterval(function() {
  window.CompanionUtils.sendAsyncMessage("Companion:GetEvents", {});
}, CALENDAR_CHECK_TIME);

function dispatchRefreshEventsEvent() {
  // Just fire an event to tell the list to check the cached events again.
  document.dispatchEvent(
    new CustomEvent("refresh-events", {
      detail: { events: window.CompanionUtils.events },
    })
  );
}
window.addEventListener("Companion:RegisterEvents", dispatchRefreshEventsEvent);
setInterval(dispatchRefreshEventsEvent, CALENDAR_UPDATE_TIME);

function debugEnabled() {
  return document.body.classList.contains("debugUI");
}

export class CalendarEventList extends MozLitElement {
  static get properties() {
    return {
      events: { type: Array },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");
      @import url("chrome://browser/content/companion/companion.css");

      .calendar {
        padding: 5px 10px;
      }

      #calendar-panel:empty {
        display: none;
      }
    `;
  }

  constructor() {
    super();
    this.events = [];
  }

  connectedCallback() {
    document.addEventListener("refresh-events", this);
    super.connectedCallback();
  }

  disconnectedCallback() {
    document.removeEventListener("refresh-events", this);
    super.disconnectedCallback();
  }

  getRelevantEvents(events) {
    if (debugEnabled()) {
      return events;
    }
    // Return all meetings that start in the next hour or are currently in
    // progress.
    let now = new Date();
    let oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    return events
      .filter(event => {
        let startDate = new Date(event.start);
        let endDate = new Date(event.end);
        return startDate <= oneHourFromNow && endDate >= now;
      })
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  handleEvent(e) {
    if (e.type == "refresh-events") {
      this.events = this.getRelevantEvents(e.detail.events);
    }
  }

  calendarEventItemsTemplate() {
    return this.events.map(
      event =>
        html`
          <calendar-event .event=${event}></calendar-event>
        `
    );
  }

  render() {
    let eventItems = this.calendarEventItemsTemplate();
    return html`
      <div class="calendar" ?hidden=${!eventItems.length}>
        <div id="calendar-panel">${eventItems}</div>
      </div>
    `;
  }
}
customElements.define("calendar-event-list", CalendarEventList);

class CalendarEvent extends MozLitElement {
  static get properties() {
    return {
      event: { type: Object },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");

      .conference-info {
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-weight: 600;
        font-size: 11px;
        color: var(--in-content-deemphasized-text);
        margin-inline-end: 8px;
        white-space: nowrap;
      }

      .event-info {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .event-actions {
        display: flex;
        gap: 4px;
        font-size: 11px;
      }

      .event-actions .button-link {
        min-height: auto;
        margin: 0;
      }

      .event-sub-details {
        display: flex;
        align-items: center;
      }

      .event-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .event img {
        width: 12px;
        height: 12px;
        object-fit: contain;
        object-position: 50% 50%;
      }

      .summary {
        font-weight: bold;
      }

      .date {
        color: var(--in-content-deemphasized-text);
        font-size: 11px;
      }

      .summary {
        /* Make some space for the link's focus outline */
        padding: 3px;
        margin: -3px;
      }

      .summary > a {
        text-decoration: none !important;
        color: var(--in-content-page-color) !important;
      }

      .line-clamp {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .event-links {
        margin-block-start: 20px;
      }
    `;
  }

  openCalendar(e) {
    e.preventDefault();
    window.CompanionUtils.sendAsyncMessage("Companion:OpenCalendar", {
      event: this.event,
    });
  }

  eventLinksTemplate() {
    let formattedLinks = this.event.links.map(link => ({
      url: link.url,
      text:
        link.text ||
        window.CompanionUtils.getPlacesData(link.url)?.title ||
        link.url,
    }));

    return formattedLinks.map(
      link =>
        html`
          <a
            class="event-link line-clamp"
            href=${link.url}
            title=${link.url}
            @click=${openLink}
            >${link.text}</a
          >
        `
    );
  }

  joinConferenceTemplate() {
    let { conference } = this.event;
    if (!conference) {
      return "";
    }
    return html`
      <a
        class="button-link primary"
        href=${conference.url}
        data-l10n-id="companion-join-meeting"
        @click=${openLink}
      ></a>
    `;
  }

  conferenceInfoTemplate() {
    let { conference } = this.event;
    if (!conference) {
      return "";
    }
    return html`
      <span class="conference-info">
        <img src=${conference.icon} alt="" />
        ${conference.name}
      </span>
    `;
  }

  eventTimeTemplate() {
    let { start, end } = this.event;
    let startTime = new Date(Date.parse(start));
    let endTime = new Date(Date.parse(end));
    let dateString = `${timeFormat.format(startTime)} - ${timeFormat.format(
      endTime
    )}`;

    return html`
      <span class="date line-clamp">${dateString}</span>
    `;
  }

  // Get the "host" of the meeting, or all attendees if the user is the host or
  // the host doesn't appear to be attending.
  _getRunningLateTargets() {
    let { attendees, creator, organizer } = this.event;
    let isNonSelfAttendee = user => {
      return (
        user &&
        !user.self &&
        // If there are no attendees treat all users as attending.
        (!attendees?.length || attendees.some(a => a.email == user.email))
      );
    };
    if (isNonSelfAttendee(organizer)) {
      // Ideally, we'd use the organizer. In a shared calendar situation the
      // organizer might actually be a generic calendar email, so confirm
      // they're attending.
      // This appears to break some events that are sent from outlook.com
      // to mozilla.com, where the organizer is not on the attendee list...
      return [organizer];
    }
    if (isNonSelfAttendee(creator)) {
      // Try the creator, who might've put the event on a shared calendar.
      // Likewise, confirm that isn't the user or an assistant who might
      // not be attending.
      return [creator];
    }
    // This is a self-hosted meeting, or the organizer and creator don't seem
    // like good addresses to message.
    return attendees;
  }

  runningLateTemplate() {
    let { summary } = this.event;
    let emailTargets = this._getRunningLateTargets();
    if (!emailTargets.length) {
      return "";
    }
    let emailTo = emailTargets.map(a => a.email).join(",");
    // FIXME: (l10n) The subject should get localised.
    return html`
      <a
        class="button-link"
        href="mailto:${emailTo}?subject=Running late to meeting ${summary}"
        data-l10n-id="companion-email-late"
        @click=${openLink}
      ></a>
    `;
  }

  render() {
    let { summary, links } = this.event;

    return html`
      <div class="event card card-no-hover">
        <div class="event-info">
          <div class="event-content">
            <div class="summary line-clamp" title=${summary}>
              <a href="#" @click=${this.openCalendar}>
                ${summary}
              </a>
            </div>
            <div class="event-sub-details">
              ${this.conferenceInfoTemplate()} ${this.eventTimeTemplate()}
            </div>
          </div>
          <div class="event-actions">
            ${this.runningLateTemplate()} ${this.joinConferenceTemplate()}
          </div>
        </div>
        <div ?hidden=${!links.length} class="event-links">
          ${this.eventLinksTemplate()}
        </div>
      </div>
    `;
  }
}
customElements.define("calendar-event", CalendarEvent);
