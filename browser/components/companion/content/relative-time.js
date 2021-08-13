/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "./widget-utils.js";
import { classMap, html, css } from "./lit.all.js";

// Update time stamp every minute
const UPDATE_TIME = 60 * 1000;

setInterval(dispatchUpdateRelativeTime, UPDATE_TIME);

function dispatchUpdateRelativeTime() {
  document.dispatchEvent(new CustomEvent("update-relative-time", {}));
}

export class RelativeTime extends MozLitElement {
  static get properties() {
    return {
      eventStart: { type: Object },
      eventEnd: { type: Object },
      formattedTimeMessageId: { type: String },
      formattedTimeMessageArgs: { type: Object },
      isHappeningNow: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");

      .event-relative-time {
        font-size: 0.8125em;
        font-weight: bold;
        color: var(--in-content-deemphasized-text);
      }

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

  static getNow() {
    return new Date();
  }

  updateTimeStamp() {
    let eventStartTime = new Date(this.eventStart).getTime();
    let eventEndTime = new Date(this.eventEnd).getTime();
    let now = this.constructor.getNow().getTime();
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
    let minutes = Math.trunc((distance / 1000 / 60) % 60);

    this.isHappeningNow = isHappeningNow;
    let { id, args } = this.getFormattedRelativeTime(hours, minutes);
    this.formattedTimeMessageId = id;
    this.formattedTimeMessageArgs = args;
  }

  getFormattedRelativeTime(hours, minutes) {
    let l10n = { args: { hours, minutes } };

    if (!hours) {
      l10n.id = this.isHappeningNow
        ? "companion-happening-now-minutes"
        : "companion-until-event-minutes";
    } else if (hours && this.isHappeningNow) {
      l10n.id =
        minutes > 0
          ? "companion-happening-now-both"
          : "companion-happening-now-hours";
    } else if (hours && !this.isHappeningNow) {
      l10n.id =
        minutes > 0
          ? "companion-until-event-both"
          : "companion-until-event-hours";
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
          "event-relative-time": true,
          "event-is-happening-now": this.isHappeningNow,
        })}
        data-l10n-id=${this.formattedTimeMessageId}
        data-l10n-args=${JSON.stringify(this.formattedTimeMessageArgs)}
      ></span>
    `;
  }
}
customElements.define("relative-time", RelativeTime);

// Helper to override the getNow method in tests.
window.RelativeTime = RelativeTime;
