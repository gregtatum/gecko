/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, styleMap, LitElement } from "../lit_glue.js";

/**
 * What color should we render a given log? We can also style things with CSS,
 * but for more complex heuristics, we must peek into the event.
 */
function getEventColor({ namespace, type }) {
  namespace = namespace || "";
  type = type || "";

  // All of these colors are somewhat random, not intentional -- change at will.

  if (/error/i.test(type)) {
    return "#c00"; // red
  }

  if (type === "expect") {
    return "rgba(0, 75, 20, 0.7)"; // greenish
  } else if (type === "match") {
    return "rgb(0, 175, 40)"; // greenish
  } else if (type === "failed-expectation") {
    return "rgb(200, 0, 0)"; // red
  }

  // Otherwise, colorize based upon namespace:

  if (namespace === "Console") {
    return "black";
  } else if (/Bridge/.test(namespace)) {
    return "#888";
  } else if (/Universe/.test(namespace)) {
    return "#844";
  } else if (/Account/.test(namespace)) {
    return "#008";
  } else if (/Sync/.test(namespace)) {
    return "#383";
  }
  var hash = 0;
  for (var i = 0; i < namespace.length; i++) {
    hash = ((hash << 5) - hash + namespace.charCodeAt(i)) | 0;
  }
  // We create a carve out 50 degrees around red at 0 to avoids red hues that
  // would collide with errors.
  var hue = (25 + ((hash & 0x0000ff) / 256) * 310) | 0;
  return "hsl(" + hue + ", 80%, 40%)";
}

function safeCss(str) {
  return str.replace(/[^a-z0-9-_]/gi, "");
}

export class LogEvent extends LitElement {
  static get properties() {
    return {
      event: { type: Object },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        line-height: 1.3;
        height: 16px;
        overflow: hidden;
      }

      .event-time {
        font-size: smaller;
        opacity: 0.3;
        margin-right: 1em;
        width: 40px;
        display: inline-block;
      }

      .event-tid {
        font-size: smaller;
        opacity: 0.3;
        margin-right: 2em;
        width: 40px;
        display: inline-block;
      }

      .event-namespace {
        margin-right: 0.5em;
        display: inline-block;
        width: 16em;
        text-align: right;
      }

      .event-type {
        margin-right: 2em;
        font-weight: bold;
      }

      .event-details {
        font-size: smaller;
      }
      .event-detail {
        padding-right: 1em;
      }

      .event-detail-key {
        opacity: 0.5;
        padding-right: 0.5em;
      }
      .event-detail-value {
        font-weight: bold;
      }

      .complex {
        cursor: pointer;
      }
    `;
  }

  constructor() {
    super();
  }

  computeDetails() {
    var details = this.event.details;
    if (!details) {
      return "";
    } else if (details.string) {
      return details.string;
    } else if (typeof details === "object") {
      return Object.keys(details).map((key, index) => {
        var val = details[key];
        var showVal = null;
        if (val === null) {
          // - Null gets to be null
          showVal = "null";
        } else if (typeof val !== "object") {
          // - Directly stringify primitives
          showVal = val + "";
          // too long?
          if (showVal.length > 100) {
            showVal = null;
          }
        } else if (
          Array.isArray(val) &&
          val.length <= 3 &&
          val.every(x => typeof x !== "object")
        ) {
          // - Show simple arrays as simple arrays
          showVal = JSON.stringify(val);
          // too long?
          if (showVal.length > 80) {
            showVal = null;
          }
        }
        if (showVal === null) {
          showVal = html`
            <span
              class="complex"
              @click=${() => {
                window.ROUTER.inspect(val);
              }}
              title=${JSON.stringify(val, null, " ")}
            >
              [...]
            </span>
          `;
        }
        return html`
          <span class="event-detail" key="${index}">
            <span class="event-detail-key">${key}</span>
            <span class="event-detail-value">${showVal}</span>
          </span>
        `;
      });
    }
    return JSON.stringify(details).slice(0, 1000);
  }

  render() {
    const event = this.event;
    const classes = [];

    // This mechanism was intended to allow easy CSS customization of specific
    // key/value pairings in the original logic-inspector (for test reasons?).
    // Retaining for now.
    for (let key in event) {
      var value = event[key];
      if (typeof value === "string" && value.length < 30) {
        classes.push(safeCss(key) + "-" + safeCss(event[key]));
      }
    }

    var styles = {
      color: getEventColor(event),
    };

    const eventTime = event.time
      .toFixed(0)
      .toString()
      .slice(-5);

    // Note: Under React, this outer div was itself the element, but because we
    // want to provide additional dynamic styling directives, we're introducing
    // this additional wrapper.  This could likely be optimized.
    return html`
      <div class=${classes.join(" ")} style=${styleMap(styles)}>
        <span class="event-time">${eventTime}</span>
        <span class="event-tid">${event.tid}</span>
        <span class="event-namespace">${event.namespace}</span>
        <span class="event-type">${event.type}</span>
        <span class="event-details">${this.computeDetails()}</span>
      </div>
    `;
  }
}
customElements.define("log-event", LogEvent);
