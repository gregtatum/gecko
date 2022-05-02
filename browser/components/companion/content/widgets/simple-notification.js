/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "../widget-utils.js";
import { css, html } from "../lit.all.js";

class SimpleNotification extends MozLitElement {
  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");

      .card {
        box-shadow: 0 2px 6px 0 rgba(58, 57, 68, 0.2);
        padding: 16px;
        margin: 16px;
        border: none;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      ::slotted(button) {
        margin: 0 !important;
        flex-shrink: 0;
      }

      .notification-icon {
        width: 24px;
        height: 24px;
      }

      .notification-content {
        flex-grow: 1;
      }

      .notification-heading {
        font-size: 1em;
        line-height: 1;
        margin: 0;
        margin-block-end: 8px;
        word-break: break-word;
      }

      .notification-description {
        font-size: 0.75em;
        color: var(--in-content-deemphasized-text);
        margin: 0;
      }
    `;
  }

  render() {
    return html`
      <div class="card card-no-hover">
        <img class="notification-icon" src=${this.icon} />
        <div class="notification-content">
          <h2 class="notification-heading">${this.heading}</h2>
          <p class="notification-description">${this.description}</p>
        </div>
        <slot name="primary-button"></slot>
      </div>
    `;
  }
}
customElements.define("simple-notification", SimpleNotification);
