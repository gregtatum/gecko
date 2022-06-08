/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import "../relative-time.js";
import { openLink, openMeeting, MozLitElement } from "../widget-utils.js";
import { css, html, classMap, until } from "../lit.all.js";

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

export class CalendarEvent extends MozLitElement {
  static FUTURE_BEFORE_START_OFFSET = 15 * 60 * 1000;
  static UP_NEXT_BEFORE_START_OFFSET = 10 * 60 * 1000;

  dateCreator = { now: () => new Date() };

  // This method is required to set timeouts longer than 10 days. It's expected
  // to come from workshopAPI.js.
  setExtendedTimeout(callback, ms) {
    throw new Error("setExtendedTimeout is required");
  }

  // This should return an object with info about a link of the form:
  //   { url, text, title, intermediateText }
  getLinkProperties(link) {
    throw new Error("getLinkProperties is required");
  }

  // This should return a string for the URL of the icon for a document.
  getDocumentIcon(link) {
    throw new Error("getDocumentIcon is required");
  }

  // This should return a string with the title of a document.
  async getDocumentTitle(url) {
    throw new Error("getDocumentTitle is required");
  }

  static get queries() {
    return {
      moreOptionsPanel: "panel-list[action=more-options]",
      firstExpandedLink: ".event-link:nth-child(3)",
    };
  }

  static get properties() {
    return {
      event: { type: Object },
      linksCollapsed: { type: Boolean },
      upcoming: { type: Boolean },
      detailsCollapsed: { type: Boolean },
      isFakeTime: { type: Boolean },
      serial: { type: Number },
      status: { type: String },
      listType: { type: String }, // "now" | "browse"
    };
  }

  static get styles() {
    return css`
      .event {
        padding: 16px 8px;
      }

      .conference-info {
        display: flex;
        align-items: center;
        gap: 0.5em;
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
        -moz-context-properties: fill;
      }

      .event-info {
        display: flex;
        flex-direction: row;
        align-items: start;
        justify-content: space-between;
        gap: 12px;
      }

      .event-conference-container {
        display: flex;
        gap: 4px;
        font-size: 0.8125em;
        width: 100%;
      }

      .event-conference-container > a {
        margin-inline: 0;
        flex-grow: 1;
        margin-block-start: 12px;
      }

      .event-sub-details {
        display: flex;
        align-items: center;
      }

      .event-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-width: 100%;
        word-break: break-all;
      }

      .event img {
        width: 12px;
        height: 12px;
        object-fit: contain;
        object-position: 50% 50%;
      }

      .summary {
        padding-bottom: 1px;
      }

      .line-clamp {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .event-links-wrapper .event-link,
      .event-links-wrapper .event-link:visited {
        display: flex;
        align-items: center;
        justify-content: start;
        white-space: normal;
        overflow: hidden;
        padding: 4px 8px;
        margin-inline: 0;
        margin: 4px 0;
        text-decoration: none;
        cursor: default;
        min-height: auto;
        background: var(--calendar-button-link-background);
        border-radius: 16px;
      }

      .event-links-wrapper .event-link:hover {
        background: var(--calendar-button-link-background-hover);
      }

      .event-link > img {
        width: 12px;
        height: 12px;
        -moz-context-properties: fill;
        fill: currentColor;
      }

      .event-link > span {
        margin-inline-start: 4px;
      }

      .event-links {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 8px;
        list-style-type: none;
        margin: 0;
        padding: 0;
        flex-grow: 1;
      }

      .event-links-wrapper {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .event-links-toggle-collapsed {
        margin: 0;
        min-width: 24px;
        align-self: start;
        justify-self: start;
        min-height: 0;
        max-width: initial;
        padding: 4px;
        border-radius: 5000px;
        border: none;
        flex-shrink: 0;
      }

      .event-links-toggle-collapsed::after {
        width: 12px;
        height: 12px;
        margin-inline-start: 4px;
        content: "";
        background-image: url("chrome://global/skin/icons/arrow-down-12.svg");
        -moz-context-properties: fill;
        fill: currentColor;
      }

      .event-links-toggle-collapsed[expanded]::after {
        transform: rotate(-180deg);
      }

      .event-top {
        display: flex;
        justify-content: space-between;
        height: fit-content;
      }

      .event:where(.up-next, .upcoming, .in-progress, .finished) .event-top {
        margin-block-end: 12px;
      }

      .event-details {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-block-start: 16px;
      }

      .event-details-none {
        margin-block-start: 0;
      }

      .event-detail-header {
        margin-block-end: 8px;
        margin-block-start: 0;
        color: var(--pine-text-color-secondary);
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
      .event-host-name-email-container,
      .event-links-wrapper .event-link span {
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }

      .event-host-image-circle {
        display: flex;
        justify-content: center;
        align-items: center;
        grid-row-start: 2;
        grid-column: 1;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        background-color: var(--calendar-host-image-background);
      }
    `;
  }

  constructor() {
    super();
    this.detailsCollapsed = true;
    this._linksCollapsed = this.linksCollapsed = true;
  }

  openMenu(e) {
    if (
      this.shouldOpenContextMenu(e) ||
      // Only open on click for keyboard events, mousedown will open for pointer events.
      (e.type == "click" && e.mozInputSource != MouseEvent.MOZ_SOURCE_KEYBOARD)
    ) {
      return;
    }
    this.moreOptionsPanel.toggle(e);
  }

  toggleDetails(e) {
    if (
      e.target.closest("button, a, panel-item") ||
      this.moreOptionsPanel.open ||
      this.shouldOpenContextMenu(e)
    ) {
      return;
    }

    // If taking keyboard input, only expand / collapse when the spacebar is
    // pressed.
    if (e.type == "keydown" && e.which != 32) {
      return;
    }

    this.detailsCollapsed = !this.detailsCollapsed;
    if (!this.detailsCollapsed) {
      this.linksCollapsed = false;
    } else {
      this.linksCollapsed = this._linksCollapsed;
    }

    // Pressing the space key causes a scroll to the bottom of the window view,
    // so suppress it.
    e.preventDefault();
  }

  shouldOpenContextMenu(e) {
    return (
      e.mozInputSource == MouseEvent.MOZ_SOURCE_MOUSE &&
      // Menu opens on right click or on ctrl + left click on mac.
      (e.button != 0 || (e.ctrlKey && e.button == 0))
    );
  }

  toggleLinksSection(e) {
    this._linksCollapsed = this.linksCollapsed = !this.linksCollapsed;
  }

  eventLinkTemplate(link) {
    let { url, text, title, intermediateText } = this.getLinkProperties(link);

    return html`
      <a class="event-link" href=${url} title=${url} @click=${openLink}>
        <img src=${this.getDocumentIcon(link)} role="presentation" />
        <span class="text-body-s">
          ${until(title, intermediateText, text)}
        </span>
      </a>
    `;
  }

  eventLinksTemplate() {
    let { event, linksCollapsed } = this;
    let { links } = event;

    if (!links?.length) {
      return "";
    }

    let shouldCollapseLinks = links.length > 2 && linksCollapsed;
    let linksToShow = shouldCollapseLinks ? links.slice(0, 2) : links;

    return html`
      <div class="event-meeting-links">
        ${this.eventDetailHeaderTemplate("companion-event-document-and-links")}
        <div class="event-links-wrapper">
          <div
            class=${classMap({
              "event-links": true,
              "event-links-collapsed": shouldCollapseLinks,
            })}
          >
            ${linksToShow.map(link => this.eventLinkTemplate(link))}
          </div>
          ${links.length > 2
            ? html`
                <button
                  data-l10n-id=${this.linksCollapsed
                    ? "companion-expand-event-links-button"
                    : "companion-collapse-event-links-button"}
                  data-l10n-args=${JSON.stringify({
                    linkCount: this.event.links.length - 2,
                  })}
                  class="event-link event-links-toggle-collapsed text-body-s"
                  ?expanded=${!this.linksCollapsed}
                  @click=${this.toggleLinksSection}
                ></button>
              `
            : ""}
        </div>
      </div>
    `;
  }

  joinConferenceTemplate() {
    let { conference } = this.event;
    if (!conference || this.status === "finished") {
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
      <span class="conference-info text-body-m">
        <img src=${conference.icon} role="presentation" />
        ${conference.name}
      </span>
    `;
  }

  eventTimeTemplate() {
    let { startDate, endDate } = this.event;
    let startTime = new Date(Date.parse(startDate));
    let endTime = new Date(Date.parse(endDate));
    let dateString = `${timeFormat.format(startTime)} - ${timeFormat.format(
      endTime
    )}`;

    return html`
      <span class="date text-body-m line-clamp">${dateString}</span>
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
          ? [
              this.eventHostTemplate(this._eventHost()),
              this.eventLinksTemplate(),
            ]
          : fallbackDetailTemplate}
      </div>
    `;
  }

  browseEventDetailsTemplate() {
    if (!this.event.links.length) {
      return "";
    }

    // A browse event only shows links + documents.
    return html`
      <div
        class=${classMap({
          "event-details": true,
        })}
      >
        ${this.eventLinksTemplate()}
      </div>
    `;
  }

  eventDetailHeaderTemplate(id) {
    return !this.detailsCollapsed
      ? html`
          <h3
            class="event-detail-header text-body-m-med"
            data-l10n-id=${id}
          ></h3>
        `
      : "";
  }

  _isSecondaryCalendarEmail(email) {
    // Don't display auto generated emails from GCal
    return email.endsWith("calendar.google.com");
  }

  _eventHost() {
    let { creator, organizer } = this.event;

    // Determine the type of host to display. This can either be an
    // "organizer" or "creator". In general, we want to display the organizer
    // of the event, but if the organizer happens to be a calendar group then
    // we should try showing the creator instead.
    let host;
    let hostType;
    if (!this._isSecondaryCalendarEmail(organizer.email)) {
      host = organizer;
      hostType = "organizer";
    } else if (creator && !this._isSecondaryCalendarEmail(creator.email)) {
      host = creator;
      hostType = "creator";
    } else if (this._isSecondaryCalendarEmail(organizer.email)) {
      // Still don't have a host. Since this is a secondary calendar, the host
      // type is a "creator", but we display the calendar's name instead of the
      // email.
      host = { ...organizer, email: null };
      hostType = "creator";
    }

    return { host, hostType };
  }

  eventHostTemplate({ host, hostType }) {
    if (!host) {
      return "";
    }

    // Now we have host, figure out what details to show.
    let name = host.name || host.displayName;
    let email = host.email;

    let emailTemplate = email
      ? html`
          <span class="event-host-email text-body-s line-clamp">${email}</span>
        `
      : null;

    // Ideally, we'll display the host's name if it's available.
    // If the host name is the same as the host email, don't display
    // the name to avoid duplicating information.
    let nameTemplate =
      name && name !== email
        ? html`
            <span class="event-host-name text-body-s line-clamp">${name}</span>
          `
        : null;

    // If a host name isn't available then just show the host type beneath the
    // the email.
    let hostTypeTemplate =
      !nameTemplate || !emailTemplate
        ? html`
            <span
              class="event-host-type text-body-s line-clamp"
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
        <div class="event-host-image-circle text-body-l-med" aria-hidden="true">
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
    let { links } = this.event;

    if (links?.length) {
      return this.eventLinksTemplate();
    }

    let hostInfo = this._eventHost();
    if (hostInfo.host && !hostInfo.host.isSelf) {
      return this.eventHostTemplate(hostInfo);
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
        !user.isSelf &&
        !this._isSecondaryCalendarEmail(user.email) &&
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
    return attendees.filter(
      a => !this._isSecondaryCalendarEmail(a.email) && !a.isSelf
    );
  }

  // If an event is less than 10 minutes away or has already started,
  // we show the join button.
  setStatus(start, end) {
    clearTimeout(this._eventUpcomingTimer?.id);
    let endDate = new Date(end);
    let startDate = new Date(start);
    let now = this.dateCreator.now();
    let futureBeforeTime = startDate - CalendarEvent.FUTURE_BEFORE_START_OFFSET;
    let upNextBeforeTime =
      startDate - CalendarEvent.UP_NEXT_BEFORE_START_OFFSET;

    // This is an array of statuses, ordered by the time that they stop being
    // in that status. The first status that has now < statusBeforeTime is the
    // currently active status.
    let statusBeforeTimes = [
      ["future", futureBeforeTime],
      ["up-next", upNextBeforeTime],
      ["upcoming", startDate],
      ["in-progress", endDate],
      ["finished", Infinity],
    ];

    // Find the first status that has a inStatusBeforeTime less than now.
    for (let i = 0; i < statusBeforeTimes.length; i++) {
      let [status, inStatusBeforeTime] = statusBeforeTimes[i];
      if (now < inStatusBeforeTime) {
        this.status = status;

        // If there's another status to transition to, then we want to
        // reevaluate our status when our inStatusBeforeTime occurs.
        if (i + 1 < statusBeforeTimes.length) {
          // The timeout can be in more than 24 days away... so we must use
          // setExtendedTimeout to avoid a delay considered as a 0!
          this._eventUpcomingTimer = this.setExtendedTimeout(() => {
            this.setStatus(start, end);
          }, inStatusBeforeTime - now);
        }

        // Once we've found a status we're done.
        break;
      }
    }
  }

  setTimeWarp() {
    const tenMinutes = 10 * 60 * 1000;
    const tenSeconds = 10 * 1000;
    let { startDate } = this.event;
    let startTime = new Date(Date.parse(startDate));
    let fakeNow = startTime.valueOf() - (tenMinutes + tenSeconds);
    this.dateCreator.TEST_timeWarp({ fakeNow });
  }

  willUpdate() {
    let { startDate, endDate } = this.event;

    this.setStatus(startDate, endDate);
  }

  render() {
    let { summary, startDate, endDate, isAllDay, conference } = this.event;
    let hideShowRunningLateOption =
      this.listType === "browse" && (isAllDay || this.status === "finished");

    return html`
      <link
        rel="stylesheet"
        href="chrome://global/skin/in-content/common.css"
      />
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/fonts.css"
      />
      <div
        class=${classMap({
          event: true,
          [this.status]: true,
          detailsCollapsed: this.detailsCollapsed,
        })}
        @mousedown=${this.toggleDetails}
      >
        <div class="event-top">
          ${this.status != "future"
            ? html`
                <relative-time
                  .eventStart=${startDate}
                  .eventEnd=${endDate}
                  .dateCreator=${this.dateCreator}
                ></relative-time>
              `
            : ""}
        </div>
        <div class="event-info">
          <div class="event-content">
            <div class="summary line-clamp text-body-l-med" title=${summary}>
              ${summary}
            </div>
            <div class="event-sub-details">
              ${this.conferenceInfoTemplate()} ${this.eventTimeTemplate()}
            </div>
          </div>
          <div class="event-card-actions">
            <button
              class="ghost-button event-options-button"
              aria-haspopup="menu"
              aria-expanded="false"
              @mousedown=${this.openMenu}
              @click=${this.openMenu}
              title="More options"
            ></button>
          </div>
        </div>
        <div class="event-conference-container">
          ${!this.detailsCollapsed ||
          this.status === "upcoming" ||
          this.status === "in-progress"
            ? this.joinConferenceTemplate()
            : ""}
        </div>
        ${this.listType !== "browse"
          ? this.eventDetailsTemplate()
          : this.browseEventDetailsTemplate()}
        <panel-list action="more-options">
          <panel-item
            class="event-item-hide-action"
            data-l10n-id="companion-hide-event"
            @click=${this.hideEvent}
            ?hidden=${this.listType === "browse"}
          ></panel-item>
          <panel-item
            class="event-item-copy-invite-action"
            data-l10n-id="companion-copy-invite"
            @click=${this.copyInvite}
            ?hidden=${!conference}
          ></panel-item>
          <panel-item
            class="event-item-running-late-action"
            data-l10n-id="companion-email-late"
            @click=${this.openRunningLate}
            ?hidden=${hideShowRunningLateOption ||
              !this._getRunningLateTargets().length}
          ></panel-item>
          <panel-item
            class="event-item-open-calendar-action"
            data-l10n-id="companion-open-calendar"
            @click=${this.openCalendar}
          ></panel-item>
          <panel-item
            class="event-item-open-calendar-action"
            data-l10n-id="companion-fake-time"
            @click=${this.setTimeWarp}
            ?hidden=${!this.isFakeTime}
          ></panel-item>
        </panel-list>
      </div>
    `;
  }
}
