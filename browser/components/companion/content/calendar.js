/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { openLink, openMeeting, MozLitElement } from "./widget-utils.js";
import { css, html, classMap, until } from "./lit.all.js";

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

const GOOGLE_DOCS_ICON =
  "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico";
const GOOGLE_SHEETS_ICON =
  "https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico";
const GOOGLE_SLIDES_ICON =
  "https://ssl.gstatic.com/docs/presentations/images/favicon5.ico";
const GOOGLE_DRIVE_ICON =
  "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png";
const DEFAULT_ICON = "chrome://global/skin/icons/defaultFavicon.svg";

// Update display every minute
const CALENDAR_UPDATE_TIME = 60 * 1000; // 1 minute

window.gCalendarEventListener = {
  init() {
    this.dispatchRefreshEventsEvent = this.dispatchRefreshEventsEvent.bind(
      this
    );

    this.initialized = new Promise(resolve => {
      this._resolveHasInitialized = resolve;
    });

    window.addEventListener(
      "Companion:RegisterEvents",
      this.dispatchRefreshEventsEvent
    );
    setInterval(this.dispatchRefreshEventsEvent, CALENDAR_UPDATE_TIME);
  },

  dispatchRefreshEventsEvent() {
    // Just fire an event to tell the list to check the cached events again.
    document.dispatchEvent(
      new CustomEvent("refresh-events", {
        detail: { events: window.CompanionUtils.events },
      })
    );
    if (this._resolveHasInitialized) {
      this._resolveHasInitialized();
      this._resolveHasInitialized = null;
    }
  },
};
window.gCalendarEventListener.init();

function debugEnabled() {
  return window.CompanionUtils.getBoolPref("browser.companion.debugUI", false);
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

      .card {
        box-shadow: 0 2px 6px 0 rgba(58, 57, 68, 0.2);
        padding: 0;
        margin: 0;
        border: none;
        border-radius: 12px;
      }

      @media (prefers-contrast) {
        .card {
          border: 1px solid transparent;
        }
      }

      .calendar {
        margin: 16px;
      }

      #calendar-panel:empty {
        display: none;
      }

      .calendar-event {
        border-bottom: 1px solid var(--in-content-border-color);
      }

      .calendar-event:last-of-type {
        border: none;
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
          <div class="calendar-event">
            <calendar-event .event=${event}></calendar-event>
          </div>
        `
    );
  }

  render() {
    let eventItems = this.calendarEventItemsTemplate();
    return html`
      <div class="calendar" ?hidden=${!eventItems.length}>
        <div id="calendar-panel" class="card card-no-hover">${eventItems}</div>
      </div>
    `;
  }
}
customElements.define("calendar-event-list", CalendarEventList);

class CalendarEvent extends MozLitElement {
  static get queries() {
    return {
      panel: "panel-list",
      firstExpandedLink: ".event-link:nth-child(3)",
    };
  }

  static get properties() {
    return {
      event: { type: Object },
      linksCollapsed: { type: Boolean },
      upcoming: { type: Boolean },
      detailsCollapsed: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");

      .event {
        padding: 16px;
      }

      .conference-info {
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-weight: 600;
        margin-inline-end: 8px;
        white-space: nowrap;
      }

      .event-options-button {
        padding: 0;
        margin: 0;
        min-width: auto;
        width: 24px;
        min-height: auto;
        height: 24px;
        background-image: url("chrome://global/skin/icons/more.svg");
        background-repeat: no-repeat;
        background-position: center;
        fill: currentColor;
      }

      .event-info {
        display: flex;
        flex-direction: row;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }

      .event-actions {
        display: flex;
        gap: 4px;
        font-size: 0.8125em;
      }

      .event-actions > a {
        margin-inline: 0;
      }

      .event:where(:not(:hover, :focus-within, .upcoming))
        .event-actions
        .button-link,
      .event:where(:not(:hover, :focus-within)) .event-options-button {
        /* This is essentially visually-hidden styles you'd use for screen
         * reader content. And we're using it so the screen reader will notice
         * the content that's hidden when not hovered/focused. */
        clip-path: inset(50%);
        overflow: hidden;
        width: 1px;
        /* height is left the same, so the parent's height doesn't change when
         * the hover/focus content is shown. */
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

      .line-clamp {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .event-links > .event-link {
        display: flex;
        white-space: normal;
        overflow: hidden;
        padding: 4px;
        border: 1px solid var(--in-content-border-color);
        margin-inline: 0;
        max-width: -moz-fit-content;
        min-width: 50%;
      }

      .event-link > img {
        width: 16px;
        height: 16px;
        -moz-context-properties: fill;
        fill: currentColor;
      }

      .event-link > span {
        margin-inline-start: 4px;
        align-self: center;
      }

      .event-links {
        display: grid;
        grid-template-columns: repeat(2, minmax(auto, max-content));
        column-gap: 8px;
      }

      .event-links-collapsed {
        grid-template-columns: repeat(2, minmax(auto, max-content)) auto;
      }

      .event-links > button.event-link {
        margin: 0;
        min-width: 0;
        align-self: center;
        justify-self: start;
        min-height: 0;
        max-width: initial;
      }

      .event-top {
        display: flex;
        justify-content: space-between;
        margin-block-end: 8px;
        height: 16px;
      }

      .event-options-button {
        min-width: auto;
        -moz-context-properties: fill;
        fill: currentColor;
      }

      .event-details {
        display: flex;
        flex-direction: column;
        gap: 20px;
        margin-block-start: 20px;
      }

      .event-details-none {
        margin-block-start: 0;
      }

      .event-detail-header {
        font-weight: bold;
        line-height: 14px;
        margin-block-end: 8px;
        margin-block-start: 0;
      }

      .conference-info,
      .date,
      .event-detail-header,
      .event-links > .event-link,
      .event-host-type,
      .event-host-email,
      .event-host-name {
        color: var(--in-content-deemphasized-text);
        font-size: 0.8125em;
      }

      /* Event host templates styles */

      .event-host {
        display: grid;
        grid-template-rows: repeat(2, min-content);
        grid-template-columns: min-content 1fr;
      }

      .event-host-name-email-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        grid-row: 2;
      }

      .event-host-email {
        display: unset;
      }

      .event-host-name,
      .event-host-type,
      .event-host-email,
      .event-host-name-email-container {
        margin-inline-start: 4px;
      }

      .event-host-email,
      .event-host-name-email-container {
        text-overflow: ellipsis;
        overflow: hidden;
      }

      .event-host-image-circle {
        display: flex;
        justify-content: center;
        align-items: center;
        grid-row-start: 2;
        grid-column: 1;
        border-radius: 50%;
        font-size: 1em;
        font-weight: bold;
        width: 32px;
        height: 32px;
        background-color: var(--in-content-border-color);
      }
    `;
  }

  constructor() {
    super();
    this.detailsCollapsed = true;
    this.linksCollapsed = true;
  }

  openCalendar(e) {
    e.preventDefault();
    window.openUrl(this.event.url);
  }

  openRunningLate(e) {
    let emailTargets = this._getRunningLateTargets();
    if (!emailTargets.length) {
      return;
    }
    let emailTo = emailTargets.map(a => a.email).join(",");
    window.openUrl(
      `mailto:${emailTo}?subject=Running late to meeting ${this.event.summary}`
    );
  }

  openMenu(e) {
    if (
      // Ignore right clicks.
      e.button != 0 ||
      // Ignore ctrl + left click which opens the context menu on mac.
      (e.ctrlKey && e.button == 0) ||
      // Only open on click for keyboard events, mousedown will open for pointer events.
      (e.type == "click" && e.mozInputSource != MouseEvent.MOZ_SOURCE_KEYBOARD)
    ) {
      return;
    }
    this.panel.toggle(e);
  }

  toggleDetails(e) {
    if (e.target.closest("button, a, panel-item") || this.panel.open) {
      return;
    }

    // If taking keyboard input, only expand / collapse when the spacebar is
    // pressed.
    if (e.type == "keydown" && e.which != 32) {
      return;
    }

    this.detailsCollapsed = !this.detailsCollapsed;

    // Pressing the space key causes a scroll to the bottom of the window view,
    // so suppress it.
    e.preventDefault();
  }

  expandLinksSection(e) {
    this.linksCollapsed = false;
    if (
      e.mozInputSource == MouseEvent.MOZ_SOURCE_KEYBOARD ||
      e.mozInputSource == MouseEvent.MOZ_SOURCE_UNKNOWN
    ) {
      this.updateComplete.then(() => {
        // If the links were expanded with the keyboard, restore focus.
        this.firstExpandedLink.focus();
      });
    }
  }

  _cachedDocumentTitles = new Map();

  getCachedDocumentTitle(url, text) {
    return this._cachedDocumentTitles.get(url) || text;
  }

  getDocumentIcon(url) {
    url = new URL(url);
    if (url.hostname.endsWith(".google.com")) {
      let type = url.href.split("/")[3];
      switch (type) {
        case "document":
          return GOOGLE_DOCS_ICON;
        case "spreadsheets":
          return GOOGLE_SHEETS_ICON;
        case "presentation":
          return GOOGLE_SLIDES_ICON;
        case "drive":
        case "file":
          return GOOGLE_DRIVE_ICON;
      }
    }
    return window.CompanionUtils.getFavicon(url.href) || DEFAULT_ICON;
  }

  async getDocumentTitle(url) {
    if (this._cachedDocumentTitles.has(url)) {
      return this._cachedDocumentTitles.get(url);
    }
    let title = await window.CompanionUtils.sendQuery(
      "Companion:GetDocumentTitle",
      { url }
    );
    if (title) {
      this._cachedDocumentTitles.set(url, title);
      return title;
    }
    throw new Error("Couldn't get a better document title");
  }

  eventLinkTemplate(link) {
    let url = link.url;
    let text = link.title || link.text || link.url;

    return html`
      <a
        class="event-link button-link"
        href=${url}
        title=${url}
        @click=${openLink}
      >
        <img src=${this.getDocumentIcon(link.url)} />
        <span class="line-clamp">
          ${until(
            this.getDocumentTitle(link.url),
            this.getCachedDocumentTitle(link.url, text),
            text
          )}
        </span>
      </a>
    `;
  }

  eventLinksTemplate() {
    let { event, linksCollapsed } = this;
    let { links } = event;

    if (!links.length) {
      return "";
    }

    let shouldCollapseLinks = links.length > 2 && linksCollapsed;
    let linksToShow = shouldCollapseLinks ? links.slice(0, 2) : links;

    return html`
      <div class="event-meeting-links">
        ${this.eventDetailHeaderTemplate("companion-event-document-and-links")}
        <div
          class=${classMap({
            "event-links": true,
            "event-links-collapsed": shouldCollapseLinks,
          })}
        >
          ${linksToShow.map(link => this.eventLinkTemplate(link))}
          ${shouldCollapseLinks
            ? html`
                <button
                  data-l10n-id="companion-expand-event-links-button"
                  data-l10n-args=${JSON.stringify({
                    linkCount: this.event.links.length - 2,
                  })}
                  class="event-link"
                  @click=${this.expandLinksSection}
                ></button>
              `
            : ""}
        </div>
      </div>
    `;
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
        @click=${openMeeting}
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

  eventDetailsTemplate() {
    let fallbackDetailTemplate = this.detailsCollapsedTemplate();

    return html`
      <div
        class=${classMap({
          "event-details": true,
          "event-details-none":
            this.detailsCollapsed && !fallbackDetailTemplate,
        })}
        tabindex="0"
        @keydown=${this.toggleDetails}
      >
        ${!this.detailsCollapsed
          ? [this.eventHostTemplate(), this.eventLinksTemplate()]
          : fallbackDetailTemplate}
      </div>
    `;
  }

  eventDetailHeaderTemplate(id) {
    return !this.detailsCollapsed
      ? html`
          <h3 class="event-detail-header" data-l10n-id=${id}></h3>
        `
      : "";
  }

  eventHostTemplate() {
    let { creator, organizer } = this.event;
    // Don't display auto generated emails from GCal
    let isCalendarEmail = e => {
      return e.includes("group.calendar.google.com");
    };

    // First, determine the type of host to display. This can either be an
    // "organizer" or "creator". In general, we want to display the organizer
    // of the event, but if the organizer happens to be a calendar group then
    // we should try showing the creator instead.
    let host;
    let hostType;
    if (!isCalendarEmail(organizer.email)) {
      host = organizer;
      hostType = "organizer";
    } else if (!isCalendarEmail(creator.email)) {
      host = creator;
      hostType = "creator";
    }
    if (!host) {
      return "";
    }

    // Now that we have host, figure out what details to show.
    let name = host.name || host.displayName;
    let email = host.email;
    let emailTemplate = html`
      <span class="event-host-email line-clamp">${email}</span>
    `;

    // Ideally, we'll display the host's name if it's available.
    let nameTemplate = name
      ? html`
          <span class="event-host-name line-clamp">${name}</span>
        `
      : null;

    // If a host name isn't available then just show the host type beneath the
    // the email.
    let hostTypeTemplate = !nameTemplate
      ? html`
          <span
            class="event-host-type line-clamp"
            data-l10n-id=${hostType === "organizer"
              ? "companion-event-organizer"
              : "companion-event-creator"}
          ></span>
        `
      : null;

    // Get the first letter of the host's name or email.
    let circleLetter = name ? name[0].toUpperCase() : email[0].toUpperCase();

    return html`
      <div class="event-host">
        ${this.eventDetailHeaderTemplate("companion-event-host")}
        <div class="event-host-image-circle">
          ${circleLetter}
        </div>
        <div class="event-host-name-email-container">
          ${nameTemplate} ${emailTemplate} ${hostTypeTemplate}
        </div>
      </div>
    `;
  }

  // Get the event detail to display when the card is collapsed.
  detailsCollapsedTemplate() {
    let { links, organizer, creator } = this.event;

    if (links?.length) {
      return this.eventLinksTemplate();
    }

    let host = organizer || creator;
    if (!host.self) {
      return this.eventHostTemplate();
    }

    return "";
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

  // If an event is less than 10 minutes away or has already started,
  // we show the join button.
  setUpcomingStatus(start, end) {
    clearTimeout(this._eventUpcomingTimer);
    let endDate = new Date(end);
    let eventStartTimeMinus10 = new Date(start) - 60 * 10 * 1000;
    let now = new Date();
    if (eventStartTimeMinus10 > now) {
      this.upcoming = false;
      this._eventUpcomingTimer = setTimeout(
        () => (this.upcoming = true),
        eventStartTimeMinus10 - now
      );
    } else if (now >= eventStartTimeMinus10 && now <= endDate) {
      this.upcoming = true;
      this._eventUpcomingTimer = setTimeout(
        () => (this.upcoming = false),
        endDate - now
      );
    }
  }

  willUpdate() {
    let { start, end } = this.event;

    this.setUpcomingStatus(start, end);
  }

  render() {
    let { summary, start, end } = this.event;

    return html`
      <div
        class=${classMap({
          event: true,
          upcoming: this.upcoming,
        })}
        @mousedown=${this.toggleDetails}
      >
        <div class="event-top">
          <relative-time .eventStart=${start} .eventEnd=${end}></relative-time>
          <button
            class="ghost-button event-options-button"
            aria-haspopup="menu"
            aria-expanded="false"
            @mousedown=${this.openMenu}
            @click=${this.openMenu}
            title="More options"
          ></button>
        </div>
        <div class="event-info">
          <div class="event-content">
            <div class="summary line-clamp" title=${summary}>${summary}</div>
            <div class="event-sub-details">
              ${this.conferenceInfoTemplate()} ${this.eventTimeTemplate()}
            </div>
          </div>
          <div class="event-actions">
            ${this.joinConferenceTemplate()}
          </div>
        </div>
        ${this.eventDetailsTemplate()}
        <panel-list>
          <panel-item
            class="event-item-running-late-action"
            data-l10n-id="companion-email-late"
            @click=${this.openRunningLate}
            ?hidden=${!this._getRunningLateTargets().length}
          ></panel-item>
          <panel-item
            data-l10n-id="companion-open-calendar"
            @click=${this.openCalendar}
          ></panel-item>
        </panel-list>
      </div>
    `;
  }
}
customElements.define("calendar-event", CalendarEvent);
