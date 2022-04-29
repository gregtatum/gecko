/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { CalendarEvent } from "./widgets/calendar-event.js";
import { MozLitElement } from "./widget-utils.js";
import { css, html, repeat } from "./lit.all.js";
import {
  setExtendedTimeout,
  Workshop,
  workshopAPI,
  workshopEnabled,
} from "./workshopAPI.js";
import { noteTelemetryTimestamp } from "./telemetry-helpers.js";

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

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
const MICROSOFT_DOCS_ICON =
  "https://res-1.cdn.office.net/files/fabric-cdn-prod_20220127.003/assets/item-types/32/docx.svg";
const MICROSOFT_SHEETS_ICON =
  "https://res-1.cdn.office.net/files/fabric-cdn-prod_20220127.003/assets/item-types/32/xlsx.svg";
const MICROSOFT_SLIDES_ICON =
  "https://res-1.cdn.office.net/files/fabric-cdn-prod_20220127.003/assets/item-types/32/pptx.svg";
// Microsoft has icons for lots of file types in OneDrive.
// This was the best generic icon I could come up with.
const MICROSOFT_DRIVE_ICON =
  "https://res-1.cdn.office.net/files/fabric-cdn-prod_20220127.003/assets/item-types/32/genericfile.svg";
const DEFAULT_ICON = "chrome://global/skin/icons/defaultFavicon.svg";

// Update display every minute
const CALENDAR_UPDATE_TIME = 60 * 1000; // 1 minute

window.gCalendarEventListener = {
  init() {
    this.dispatchRefreshEventsEvent = this.dispatchRefreshEventsEvent.bind(
      this
    );

    // TODO(MR2-2224): _calendarEvents isn't needed for Workshop.
    this._calendarEvents = [];

    window.addEventListener("Companion:RegisterCalendarEvents", this);
    window.addEventListener("Companion:SignIn", this);

    setInterval(this.dispatchRefreshEventsEvent, CALENDAR_UPDATE_TIME);
  },

  dispatchRefreshEventsEvent() {
    // Just fire an event to tell the list to check the cached events again.
    document.dispatchEvent(
      new CustomEvent("refresh-events", {
        // TODO(MR2-2224): We shouldn't need the config for Workshop.
        detail: { events: this._calendarEvents },
      })
    );
  },

  handleEvent({ type, detail }) {
    switch (type) {
      case "Companion:RegisterCalendarEvents": {
        this._calendarEvents = detail.events;
        if (!workshopEnabled) {
          this.dispatchRefreshEventsEvent();
        }
        break;
      }
      case "Companion:SignIn": {
        this.dispatchRefreshEventsEvent();
        break;
      }
    }
  },
};
window.gCalendarEventListener.init();

function debugEnabled() {
  return window.CompanionUtils.getBoolPref("browser.companion.debugUI", false);
}

/**
 * Event Management Lifecycle (Workshop)
 *
 * The list of events is manged by the `listView` property, which will have its
 * spec set based on if this element's `listType` is "now" or "browse".
 *
 * When we get updates to the list of events, the `onListViewUpdated` method
 * will be called. The `serial` on `listView` is checked and the events will
 * get updated.
 *
 * Creation:
 *   - connectedCallback() -> The `listView` is created.
 * Updates:
 *   - onListViewUpdated() -> The `listView` has "seeked" (updated)
 * Refresh:
 *   - "refresh-events" triggers every minute, this will tell workshop to check
 *     the server for updated event data.
 *   - Companion:RegisterCalendarEvents will also trigger a "refresh-events" to
 *     update the listView from the server.
 *
 *
 */
export class CalendarEventList extends MozLitElement {
  static get properties() {
    return {
      events: { type: Array },
      listType: { type: String },
    };
  }

  static get styles() {
    return css`
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
        margin: 0 8px;
        border-block-start: 1px solid var(--in-content-border-color);
      }

      .calendar-event:first-of-type,
      .calendar-break-time + .calendar-event {
        border: none;
      }

      .calendar-break-time {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 8px;
        color: var(--pine-text-color-deemphasized);
      }

      .calendar-break-time-divider {
        border-block-start: 1px solid var(--in-content-border-color);
        width: 100%;
      }

      .calendar-break-time-label {
        position: absolute;
        background-color: var(--in-content-page-background);
        padding: 0 8px;
        display: flex;
        align-items: center;
      }

      .calendar-break-time-icon {
        margin-inline-end: 4px;
        height: 13px;
        width: 12px;
        background-image: url("chrome://browser/content/companion/breakTime.svg");
        background-repeat: no-repeat;
        background-position: center;
        fill: currentColor;
        -moz-context-properties: fill;
      }
    `;
  }

  constructor() {
    super();
    this.events = [];
    this.listView = null;
    this.listType = "";
    this.isFakeTime = false;
  }

  maybeStopListening() {
    this.listView.removeListener("seeked", this, this.onListViewUpdated);
  }

  maybeListen() {
    this.listView.seekToTop(10, 990);
    this.listView.on("seeked", this, this.onListViewUpdated);
  }

  connectedCallback() {
    document.addEventListener("refresh-events", this);

    if (workshopEnabled) {
      this.createCalendarListView();
      window.addEventListener("unload", () => {
        this.cleanup();
      });
      workshopAPI.accounts.on("add", this, this.createCalendarListView);
      workshopAPI.accounts.on("remove", this, this.createCalendarListView);
      workshopAPI.on("time-warp", this, this.onTimeWarp);
    }

    super.connectedCallback();
  }

  disconnectedCallback() {
    document.removeEventListener("refresh-events", this);

    if (workshopEnabled) {
      this.cleanup();
      workshopAPI.accounts.removeListener(
        "add",
        this,
        this.createCalendarListView
      );
      workshopAPI.accounts.removeListener(
        "remove",
        this,
        this.createCalendarListView
      );
      workshopAPI.removeListener("time-warp", this, this.onTimeWarp);
    }

    super.disconnectedCallback();
  }

  async onTimeWarp() {
    this.isFakeTime = true;
    await Workshop.refreshServices();
    this.refreshView();
  }

  onListViewUpdated() {
    let plainEvents = this.getRelevantEvents(
      this.listView.items.filter(event => event)
    );
    this.events = this.getEventsAndBreaks(plainEvents);

    if (this.serial !== this.listView.serial) {
      this.serial = this.listView.serial;
      this.dispatchOnUpdateComplete(
        new CustomEvent("calendar-events-updated", {
          detail: { eventCount: plainEvents.length },
        })
      );
    }
    noteTelemetryTimestamp("Companion:CalendarPainted", {
      numberOfEvents: this.events.length,
    });
  }

  unloadListView() {
    this.listView.release();
    this.listView = null;
  }

  listenToListView() {
    if (this.listView) {
      this.maybeStopListening();
      this.maybeListen();
    }
  }

  getRelevantEvents(events) {
    // De-duplicate events based on the original ID provided by the service
    // TODO: Apply a concept of precedence so that the user's personal calendar
    // version of the event supersedes any group calendar event. This should
    // ideally be handled by a follow-up to MR2-1903 by handling this in the
    // VirtualConversationTOC.
    let uniqueEvents = [
      ...new Map(
        events.map(event => [event.originalId || event.id, event])
      ).values(),
    ];

    if (!debugEnabled() && this.listType != "browse") {
      // TODO: remove this method: this stuff is done in workshop.
      // Return all meetings that start in the next hour or are currently in
      // progress.
      let now = workshopAPI.now();
      let oneHourFromNow = workshopAPI.now();
      oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
      uniqueEvents = uniqueEvents.filter(event => {
        let startDate = new Date(event.startDate);
        let endDate = new Date(event.endDate);

        return startDate <= oneHourFromNow && endDate >= now && !event.isAllDay;
      });
    }
    return uniqueEvents.sort(
      (a, b) => new Date(a.startDate) - new Date(b.startDate)
    );
  }

  handleEvent(e) {
    if (e.type == "refresh-events") {
      if (workshopEnabled) {
        this.refreshView();
      } else {
        let plainEvents = this.getRelevantEvents(e.detail.events);
        let eventsAndBreaks = this.getEventsAndBreaks(plainEvents);
        this.events = eventsAndBreaks;
        noteTelemetryTimestamp("Companion:CalendarPainted", {
          numberOfEvents: this.events.length,
        });
      }
    }
  }

  getEventsAndBreaks(events) {
    let minBreakTime = Services.prefs.getIntPref(
      "browser.pinebuild.calendar.minBreakTime",
      0
    );
    let maxBreakTime = Services.prefs.getIntPref(
      "browser.pinebuild.calendar.maxBreakTime",
      0
    );

    if (!maxBreakTime || minBreakTime > maxBreakTime || events.length < 2) {
      return events;
    }

    let [firstEvent, ...otherEvents] = events;
    let eventsAndBreaks = [firstEvent];
    for (let event of otherEvents) {
      let lastEvent = eventsAndBreaks.at(-1);
      let timeBetween = Math.round(
        (new Date(event.startDate) - new Date(lastEvent.endDate)) / 60 / 1000
      );
      if (minBreakTime <= timeBetween && timeBetween <= maxBreakTime) {
        eventsAndBreaks.push({
          isBreakTime: true,
          length: timeBetween,
        });
      }
      eventsAndBreaks.push(event);
    }
    return eventsAndBreaks;
  }

  refreshView() {
    this.listView?.refresh();
  }

  async createCalendarListView() {
    this.cleanup();

    let accounts = await Workshop.getConnectedAccounts();
    if (accounts.length) {
      if (this.listType === "browse") {
        this.listView = Workshop.createBrowseListView();
      } else {
        this.listView = Workshop.createCalendarListView();
      }
      this.listenToListView();
    } else {
      // TODO(MR2-2330): Remove the accounts listeners and just rely on seeked.
      // If there arent't any connected accounts, just clear the events list.
      this.events = [];
    }
  }

  calendarEventItemsTemplate() {
    if (!this.events.length) {
      return null;
    }

    return repeat(
      this.events,
      event => event.id,
      event =>
        event.isBreakTime
          ? html`
              <div class="calendar-break-time">
                <hr class="calendar-break-time-divider"></hr>
                <div class="calendar-break-time-label">
                  <span class="calendar-break-time-icon"></span>
                  <span
                    class="calendar-break-time-text text-body-s"
                    data-l10n-id="companion-event-break"
                    data-l10n-args=${JSON.stringify({
                      duration: event.length,
                    })}
                  ></span>
                </div>
              </div>
            `
          : html`
              <div class="calendar-event">
                <calendar-event
                  .isFakeTime=${this.isFakeTime}
                  .event=${event}
                  .serial=${event.serial}
                  .listType=${this.listType}
                ></calendar-event>
              </div>
            `
    );
  }

  render() {
    let eventItems = this.calendarEventItemsTemplate();
    return html`
      <link
        rel="stylesheet"
        href="chrome://global/skin/in-content/common.css"
      />
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/fonts.css"
      />
      <div class="calendar" ?hidden=${!eventItems}>
        <div id="calendar-panel" class="card card-no-hover">${eventItems}</div>
      </div>
    `;
  }

  cleanup() {
    if (this.listView) {
      this.maybeStopListening();
      this.unloadListView();
    }
  }
}
customElements.define("calendar-event-list", CalendarEventList);

class CalendarEventWrapper extends CalendarEvent {
  setExtendedTimeout = setExtendedTimeout;
  _cachedDocumentTitles = new Map();
  dateCreator = workshopAPI;

  openCalendar(e) {
    e.preventDefault();
    let url = this.event.url;
    if (workshopEnabled && url.includes("google")) {
      const account = Workshop.getAccountByType("google");
      if (account) {
        let formattedURL = new URL(url);
        formattedURL.searchParams.set("authuser", account.name);
        url = formattedURL.href;
      }
    }
    window.openUrl(url);
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

  getCachedDocumentTitle(url, text) {
    return this._cachedDocumentTitles.get(url) || text;
  }

  getLinkProperties(link) {
    let url = link.url;
    let text, title, intermediateText;
    if (workshopEnabled) {
      title = link.docInfo?.title;
      text = title || link.title || link.text || link.url;
      intermediateText = text;
      title = title
        ? Promise.resolve(title)
        : Promise.reject(new Error("No title"));
    } else {
      title = this.getDocumentTitle(link.url);
      text = link.title || link.text || link.url;
      intermediateText = this.getCachedDocumentTitle(url, text);
    }
    return { url, text, title, intermediateText };
  }

  getDocumentIcon(link) {
    const url = new URL(link.url);
    const { href } = url;

    let type;
    if (workshopEnabled) {
      type = link.docInfo?.type;
    } else if (url.hostname.endsWith(".google.com")) {
      type = href.split("/")[3];
    }
    switch (type) {
      case "ms-document":
        return MICROSOFT_DOCS_ICON;
      case "ms-spreadsheet":
        return MICROSOFT_SHEETS_ICON;
      case "ms-presentation":
        return MICROSOFT_SLIDES_ICON;
      case "ms-drive":
        return MICROSOFT_DRIVE_ICON;
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

    return window.CompanionUtils.getFavicon(href) || DEFAULT_ICON;
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

  setTimeWarp() {
    const tenMinutes = 10 * 60 * 1000;
    const tenSeconds = 10 * 1000;
    let { startDate } = this.event;
    let startTime = new Date(Date.parse(startDate));
    let fakeNow = startTime.valueOf() - (tenMinutes + tenSeconds);
    workshopAPI.TEST_timeWarp({ fakeNow });
  }
}
customElements.define("calendar-event", CalendarEventWrapper);
