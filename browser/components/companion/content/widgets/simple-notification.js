/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "../widget-utils.js";
import { css, html, until } from "../lit.all.js";

class SimpleNotification extends MozLitElement {
  static get properties() {
    return {
      icon: { type: String },
      heading: { type: String },
      description: { type: String },
    };
  }

  static get queries() {
    return {
      iconEl: ".notification-icon",
      headingEl: ".notification-heading",
      descriptionEl: ".notification-description",
    };
  }

  static get styles() {
    return css`
      .card {
        box-shadow: -1px 2px 4px rgba(122, 94, 63, 0.08);
        padding-inline: 16px;
        padding-block: 12px;
        margin: 16px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        border: 0.5px solid var(--notification-card-border-color);
        box-sizing: border-box;
      }

      ::slotted(button) {
        margin: 0 !important;
        flex-shrink: 0;
      }

      .notification-icon-container {
        height: 32px;
        width: 32px;
        display: flex;
        justify-content: center;
        align-items: center;
        border: 0.5px solid var(--notification-icon-border-color);
        border-radius: 50%;
        box-sizing: border-box;
        flex-shrink: 0;
      }

      .notification-icon {
        width: 20px;
        height: 20px;
      }

      .notification-content {
        flex-grow: 1;
      }

      .notification-heading {
        margin: 0;
        margin-block-end: 4px;
        word-break: break-word;
      }

      .notification-description {
        color: var(--pine-text-color-secondary);
        margin: 0;
      }
    `;
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://global/skin/in-content/common.css"
      />
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/fonts.css"
      />

      <div class="card card-no-hover">
        <div class="notification-icon-container">
          <img class="notification-icon" src=${this.icon} />
        </div>
        <div class="notification-content">
          <h2 class="notification-heading text-body-l-med">${this.heading}</h2>
          <p class="notification-description text-body-s">
            ${until(this.description)}
          </p>
        </div>
        <slot name="primary-action"></slot>
      </div>
    `;
  }
}
customElements.define("simple-notification", SimpleNotification);
