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
      timeStamp: { type: Object },
      isLate: { type: Boolean },
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

      .event-is-late {
        color: rgb(197, 0, 66); /* proton-red-70  */
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
    let eventTime = new Date(this.eventStart).getTime();
    let now = this.constructor.getNow().getTime();

    let distance = Math.abs(eventTime - now);
    let minutes = Math.trunc((distance / 1000 / 60) % 60);

    this.isLate = now > eventTime;
    this.timeStamp = this.getFormattedRelativeTime(minutes);
  }

  getFormattedRelativeTime(minutes) {
    let l10n = {};

    l10n.id = this.isLate
      ? "companion-minutes-after-event"
      : "companion-minutes-before-event";
    l10n.args = { minutes };

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
    let { id, args } = this.timeStamp;

    return html`
      <span
        class=${classMap({
          "event-relative-time": true,
          "event-is-late": this.isLate,
        })}
        data-l10n-id=${id}
        data-l10n-args=${JSON.stringify(args)}
      ></span>
    `;
  }
}
customElements.define("relative-time", RelativeTime);

// Helper to override the getNow method in tests.
window.RelativeTime = RelativeTime;
