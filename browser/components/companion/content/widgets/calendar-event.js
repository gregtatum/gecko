/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import "./action-button.js";
import "../relative-time.js";
import { openLink, openMeeting, MozLitElement } from "../widget-utils.js";
import { css, html, classMap, until } from "../lit.all.js";

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

const DEFAULT_FUTURE_BEFORE_START_OFFSET = 15 * 60 * 1000;
const DEFAULT_UP_NEXT_BEFORE_START_OFFSET = 10 * 60 * 1000;
export class CalendarEvent extends MozLitElement {
  static FUTURE_BEFORE_START_OFFSET = DEFAULT_FUTURE_BEFORE_START_OFFSET;
  static UP_NEXT_BEFORE_START_OFFSET = DEFAULT_UP_NEXT_BEFORE_START_OFFSET;

  static _mockBeforeStartOffsets(future, upNext) {
    CalendarEvent.FUTURE_BEFORE_START_OFFSET = future;
    CalendarEvent.UP_NEXT_BEFORE_START_OFFSET = upNext;
  }

  static _resetBeforeStartOffsets() {
    CalendarEvent.FUTURE_BEFORE_START_OFFSET = DEFAULT_FUTURE_BEFORE_START_OFFSET;
    CalendarEvent.UP_NEXT_BEFORE_START_OFFSET = DEFAULT_UP_NEXT_BEFORE_START_OFFSET;
  }

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
      relativeTime: "relative-time",
      joinMeetingButton: ".join-meeting-button",
      expandButton: ".event-expand-button",
    };
  }

  static get properties() {
    return {
      event: { type: Object },
      isFakeTime: { type: Boolean },
      serial: { type: Number },
      listType: { type: String }, // "now" | "browse"
      status: { type: String, state: true },
      linksCollapsed: { type: Boolean, state: true },
      detailsCollapsed: { type: Boolean, state: true },
    };
  }

  static get styles() {
    return css`
      .event {
        padding: 16px 8px;
      }

      .event,
      .event-link,
      .event button,
      .event a {
        cursor: pointer;
      }

      .conference-info {
        display: flex;
        align-items: center;
        gap: 0.5em;
        margin-inline-end: 8px;
        white-space: nowrap;
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
        min-height: auto;
        border-radius: 16px;
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

      .event .event-links-toggle-collapsed {
        align-self: start;
        justify-self: start;
        justify-content: center;
      }

      .event-expand-button,
      .event-links-toggle-collapsed {
        flex-shrink: 0;
        margin: 0;
        padding: 0;
        min-width: 0;
        min-height: 0;
        height: 24px;
        width: 24px;
        border-radius: 100px;
      }

      .event-expand-button {
        background-position: center;
        background-repeat: no-repeat;
        background-image: url("chrome://global/skin/icons/arrow-down-12.svg");
        background-size: 14px auto;
        -moz-context-properties: fill;
        fill: var(--icon-color-default);
      }

      .event:not(.detailsCollapsed) .event-expand-button {
        transform: rotate(-180deg);
      }

      .event .event-button-secondary {
        box-sizing: border-box;
        background-color: var(--calendar-button-secondary-background);
        border: 0.5px solid var(--calendar-button-secondary-background);
      }

      .event .event-button-secondary:hover {
        background-color: var(--calendar-button-secondary-background-hover);
        border-color: var(--action-button-border-color-hover);
      }

      .event .event-button-secondary:focus-visible {
        background-color: var(--calendar-button-secondary-background-hover);
        border-color: var(--calendar-button-secondary-background-hover);
        outline-offset: 0;
      }

      .event .event-button-secondary:active {
        background-color: var(--calendar-button-secondary-background-active);
        border-color: var(--action-button-border-color-hover);
      }

      @media (prefers-contrast) {
        .event .event-button-secondary:active,
        .event .event-button-secondary {
          border: 0.5px solid var(--in-content-button-border-color);
          color: var(--in-content-button-text-color);
          fill: currentColor;
        }

        .event .event-button-secondary:hover {
          background-color: var(--in-content-button-background-hover);
          color: var(--in-content-button-text-color-hover);
        }

        .event .event-button-secondary:hover:active {
          background-color: SelectedItem;
          color: SelectedItemText;
        }
      }

      .event-quick-actions {
        display: flex;
        justify-content: space-between;
      }

      .event-quick-actions + .event-meeting-links,
      .event-quick-actions + .event-host {
        border-block-start: 1px solid var(--calendar-divider-border-color);
        padding-block-start: 16px;
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
    this.linksCollapsed = true;
    this.detailsCollapsed = true;
  }

  toggleDetails(e) {
    if (
      e.target.closest(
        "button.event-links-toggle-collapsed, a, action-button"
      ) ||
      this.shouldOpenContextMenu(e)
    ) {
      return;
    }

    // Pressing the space key causes a scroll to the bottom of the window view,
    // so suppress it.
    e.preventDefault();

    this.detailsCollapsed = this.linksCollapsed = !this.detailsCollapsed;
    this.dispatchEvent(
      new CustomEvent("toggle-details", { detail: { eventId: this.event.id } })
    );
  }

  shouldOpenContextMenu(e) {
    return (
      e.mozInputSource == MouseEvent.MOZ_SOURCE_MOUSE &&
      // Menu opens on right click or on ctrl + left click on mac.
      (e.button != 0 || (e.ctrlKey && e.button == 0))
    );
  }

  toggleLinksSection(e) {
    this.linksCollapsed = !this.linksCollapsed;
  }

  eventLinkTemplate(link) {
    let { url, text, title, intermediateText } = this.getLinkProperties(link);

    return html`
      <a
        class="event-link event-button-secondary"
        href=${url}
        title=${url}
        @click=${openLink}
      >
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
                  data-l10n-id=${linksCollapsed
                    ? "companion-expand-event-links-button"
                    : "companion-collapse-event-links-button"}
                  data-l10n-args=${JSON.stringify({
                    linkCount: this.event.links.length - 2,
                  })}
                  class="event-link event-links-toggle-collapsed text-body-s event-button-secondary"
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
        class="button-link primary join-meeting-button"
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
      >
        ${!this.detailsCollapsed
          ? [
              this.eventActionsTemplate(),
              this.eventLinksTemplate(),
              this.eventHostTemplate(this._eventHost()),
            ]
          : fallbackDetailTemplate}
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
    if (hostInfo.host && !hostInfo.host.isSelf && !this.isBrowse) {
      return this.eventHostTemplate(hostInfo);
    }

    return "";
  }

  eventActionsTemplate() {
    const actionsConfig = {
      hide: {
        icon: "chrome://global/skin/icons/close.svg",
        label: "companion-hide-event",
        disabled: this.isBrowse,
        eventHandler: this.hideEvent,
        class: "event-item-hide-action",
      },
      copy: {
        icon: "chrome://global/skin/icons/link.svg",
        label: "companion-copy-invite",
        disabled: !this.event.conference,
        eventHandler: this.copyInvite,
        class: "event-item-copy-invite-action",
      },
      message: {
        icon: "chrome://browser/content/companion/running-late.svg",
        label: this._getEmailLabel(),
        disabled:
          (this.isBrowse && this.event.isAllDay) ||
          !this._getEmailTargets().length,
        eventHandler: this.openEmail,
        class: "event-item-email-action",
      },
      open: {
        icon: "chrome://global/skin/icons/open-in-new.svg",
        label: "companion-open-calendar",
        eventHandler: this.openCalendar,
        class: "event-item-open-calendar-action",
      },
      // Used for development / testing purposes only
      timeWarp: {
        icon: "chrome://browser/content/companion/breakTime.svg",
        label: "companion-fake-time",
        eventHandler: this.setTimeWarp,
        hidden: !this.isFakeTime,
      },
    };

    return html`
      <div class="event-quick-actions">
        ${Object.values(actionsConfig).map(action => {
          if (action.hidden) {
            return "";
          }
          return html`
            <action-button
              class=${action.class}
              .icon=${action.icon}
              .label=${action.label}
              .disabled=${action.disabled}
              @click=${action.eventHandler}
            ></action-button>
          `;
        })}
      </div>
    `;
  }

  // Get the "host" of the meeting, or all attendees if the user is the host or
  // the host doesn't appear to be attending.
  _getEmailTargets() {
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

  _getEmailLabel() {
    if (this.status !== "finished") {
      return "companion-email-late";
    }

    let hostInfo = this._eventHost();

    if (hostInfo.host && hostInfo.host.isSelf) {
      return "companion-message-attendees";
    }

    return "companion-message-host";
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
            this.dispatchEvent(new Event("status-transition"));
          }, inStatusBeforeTime - now);
        }

        // Once we've found a status we're done.
        break;
      }
    }
  }

  setTimeWarp(fakeNow) {
    if (!fakeNow) {
      const tenMinutes = 10 * 60 * 1000;
      const tenSeconds = 10 * 1000;
      let { startDate } = this.event;
      let startTime = new Date(Date.parse(startDate));
      fakeNow = startTime.valueOf() - (tenMinutes + tenSeconds);
    }
    if (this.dateCreator.TEST_timeWarp) {
      this.dateCreator.TEST_timeWarp({ fakeNow });
    } else {
      this.dateCreator.now = () => new Date(fakeNow);
    }
  }

  get isBrowse() {
    return this.listType === "browse";
  }

  willUpdate() {
    let { startDate, endDate } = this.event;

    this.setStatus(startDate, endDate);
  }

  render() {
    let { summary, startDate, endDate } = this.event;

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
        @click=${this.toggleDetails}
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
          <button
            class="event-button-secondary event-expand-button"
            aria-expanded=${!this.detailsCollapsed}
            data-l10n-id=${this.detailsCollapsed
              ? "calendar-event-show-details"
              : "calendar-event-hide-details"}
          ></button>
        </div>
        <div class="event-conference-container">
          ${!this.detailsCollapsed ||
          this.status === "upcoming" ||
          this.status === "in-progress"
            ? this.joinConferenceTemplate()
            : ""}
        </div>
        ${this.eventDetailsTemplate()}
      </div>
    `;
  }
}
