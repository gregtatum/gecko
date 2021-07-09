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

      .event {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 4px 8px;
        cursor: default;
        box-shadow: none;
        border: 1px solid var(--in-content-border-color);
      }

      .conference-info {
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-weight: 600;
        font-size: 11px;
        color: var(--in-content-deemphasized-text);
      }

      .event-info {
        flex: 1;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }

      .event-actions {
        display: flex;
        align-self: start;
        gap: 4px;
        font-size: 11px;
      }

      .event-actions .button-link {
        min-height: auto;
        margin: 0;
      }

      .event img {
        width: 16px;
        height: 16px;
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

      .event-link {
        /* This needs to be block-style for the ellipsis to work. */
        /* Also they're currently one per line. */
        display: block;
      }

      .summary,
      .subject,
      .title,
      .event-link {
        max-width: 125px;
        text-overflow: ellipsis;
        overflow-x: hidden;
        white-space: nowrap;
      }

      .summary {
        /* Make some space for the link's focus outline */
        padding: 3px;
        margin-inline-start: -3px;
        margin-block-start: -3px;
      }

      .summary > a {
        text-decoration: none !important;
        color: var(--in-content-page-color) !important;
      }
    `;
  }

  openCalendar(e) {
    e.preventDefault();
    window.CompanionUtils.sendAsyncMessage("Companion:OpenCalendar", {
      start: new Date(this.event.start),
      serviceId: this.event.serviceId,
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
            class="event-link"
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
      <div class="conference-info">
        <img src=${conference.icon} alt="" />
        ${conference.name}
      </div>
    `;
  }

  emailGuestsTemplate() {
    let { attendees, summary } = this.event;
    if (!attendees?.length) {
      return "";
    }
    let attendeeEmails = attendees.map(a => a.email).join(",");
    // FIXME: (l10n) The subject should get localised.
    return html`
      <a
        class="button-link"
        href="mailto:${attendeeEmails}?subject=Running late to ${summary}"
        data-l10n-id="companion-email-guests"
        @click=${openLink}
      ></a>
    `;
  }

  render() {
    let { start, end, summary } = this.event;

    let startTime = new Date(Date.parse(start));
    let endTime = new Date(Date.parse(end));
    let dateString = `${timeFormat.format(startTime)} - ${timeFormat.format(
      endTime
    )}`;

    return html`
      <div class="event card card-no-hover">
        ${this.conferenceInfoTemplate()}
        <div class="event-info">
          <div class="event-content">
            <div class="summary" title=${summary}>
              <a href="#" @click=${this.openCalendar}>
                ${summary}
              </a>
            </div>
            <div class="date">${dateString}</div>
            <div class="links">${this.eventLinksTemplate()}</div>
          </div>
          <div class="event-actions">
            ${this.emailGuestsTemplate()} ${this.joinConferenceTemplate()}
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define("calendar-event", CalendarEvent);
