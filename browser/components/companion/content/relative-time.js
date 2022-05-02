/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "./widget-utils.js";
import { classMap, html, css } from "./lit.all.js";

function dispatchUpdateRelativeTime() {
  document.dispatchEvent(new CustomEvent("update-relative-time", {}));
  let newTimeout = new Date();
  // Update time stamp every minute
  newTimeout.setMinutes(newTimeout.getMinutes() + 1, 0, 0);
  setTimeout(dispatchUpdateRelativeTime, newTimeout.getTime() - Date.now());
}
dispatchUpdateRelativeTime();

export class RelativeTime extends MozLitElement {
  dateCreator = { now: () => new Date() };

  static get properties() {
    return {
      eventStart: { type: Object },
      eventEnd: { type: Object },
      formattedTimeMessageId: { type: String },
      formattedTimeMessageArgs: { type: Object },
      isHappeningNow: { type: Boolean },
      isHidden: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");
      @import url("chrome://browser/content/companion/fonts.css");

      .event-is-happening-now {
        color: var(--in-content-accent-color);
      }
    `;
  }

  connectedCallback() {
    document.addEventListener("update-relative-time", this);
    this.updateTimeStamp();
    super.connectedCallback();
  }

  disconnectedCallback() {
    document.removeEventListener("update-relative-time", this);
    super.disconnectedCallback();
  }

  get getNow() {
    // Tests mock this with RelativeTime.getNow. Prefer that over `dateCreator`
    // which is Date in storybook or workshopAPI for TimeWarp in production.
    return this.constructor.getNow ?? this.dateCreator.now;
  }

  updateTimeStamp() {
    let eventStartTime = new Date(this.eventStart).getTime();
    let eventEndTime = new Date(this.eventEnd).getTime();
    let now = this.getNow().getTime();
    let isHappeningNow = now >= eventStartTime;

    // This only happens on debug mode, but it would probably be good to handle this
    // case as well.
    if (now > eventEndTime) {
      this.isHappeningNow = isHappeningNow;
      this.formattedTimeMessageId = "companion-event-finished";
      this.formattedTimeMessageArgs = {};
      return;
    }

    let distance = isHappeningNow
      ? Math.abs(eventEndTime - now)
      : Math.abs(eventStartTime - now);

    let hours = Math.trunc(
      (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    let minutes = Math.round((distance / 1000 / 60) % 60);

    this.isHappeningNow = isHappeningNow;
    let { id, args } = this.getFormattedRelativeTime(hours, minutes);
    this.formattedTimeMessageId = id;
    this.formattedTimeMessageArgs = args;
  }

  getFormattedRelativeTime(hours, minutes) {
    let l10n = { args: { hours, minutes } };

    this.isHidden = false;
    if (hours || minutes > 15) {
      if (this.isHappeningNow) {
        l10n.id = "companion-happening-now";
      } else {
        this.isHidden = true;
      }
    } else if (minutes > 10) {
      l10n.id = this.isHappeningNow
        ? "companion-ending-soon"
        : "companion-up-next";
    } else if (minutes > 5) {
      l10n.id = this.isHappeningNow
        ? "companion-ending-soon"
        : "companion-starting-soon";
    } else {
      l10n.id = this.isHappeningNow
        ? "companion-almost-over"
        : "companion-until-event-minutes";
    }
    return l10n;
  }

  handleEvent(e) {
    if (e.type === "update-relative-time") {
      this.updateTimeStamp();
    }
  }

  update(changedProperties) {
    // The calendar event start time could be updated after relative-time.
    // (i.e: manually refreshing services from about:preferences). So manually update
    // the time stamp before rendering.
    if (changedProperties.has("eventStart")) {
      this.updateTimeStamp();
    }

    super.update(changedProperties);
  }

  render() {
    return html`
      <span
        class=${classMap({
          "event-relative-time text-body-m-med": true,
          "event-is-happening-now": this.isHappeningNow,
        })}
        ?hidden=${this.isHidden}
        data-l10n-id=${this.formattedTimeMessageId}
        data-l10n-args=${JSON.stringify(this.formattedTimeMessageArgs)}
      ></span>
    `;
  }
}
customElements.define("relative-time", RelativeTime);

// Helper to override the getNow method in tests.
window.RelativeTime = RelativeTime;
