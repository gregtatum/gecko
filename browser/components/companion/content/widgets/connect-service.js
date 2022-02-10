/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "../widget-utils.js";
import { css, html, classMap } from "../lit.all.js";

class ConnectServiceNotification extends MozLitElement {
  static get properties() {
    return {
      authenticating: { type: Boolean },
      connected: { type: Boolean },
      icon: { type: String },
      name: { type: String },
      services: { type: String },
    };
  }

  static get queries() {
    return {
      connectButton: ".connect-service-button",
    };
  }

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

      .connect-service-icon {
        width: 24px;
        height: 24px;
      }

      .connect-service-description {
        flex-grow: 1;
      }

      .connect-service-name {
        font-size: 1em;
        line-height: 1;
        margin: 0;
        margin-block-end: 8px;
        word-break: break-word;
      }

      .connect-service-services {
        font-size: 0.75em;
        color: var(--in-content-deemphasized-text);
        margin: 0;
      }

      .connect-service-button {
        /* flex for the green connected dot. */
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0;
        flex-shrink: 0;
      }

      .connect-service-button.connected::before {
        display: inline-block;
        content: "";
        padding: 2px;
        border-radius: 50%;
        background-color: #2ac3a2;
        height: 4px;
        width: 4px;
        flex-shrink: 0;
        flex-grow: 0;
      }
    `;
  }

  connectService() {
    if (!this.connected) {
      this.connectServiceCallback();
    }
  }

  get connectButtonLabelId() {
    if (this.authenticating) {
      return "companion-onboarding-service-connecting";
    }
    if (this.connected) {
      return "companion-onboarding-service-connected";
    }
    return "companion-onboarding-service-connect";
  }

  render() {
    return html`
      <div class="card card-no-hover">
        <img class="connect-service-icon" src=${this.icon} />
        <div class="connect-service-description">
          <h2 class="connect-service-name">${this.name}</h2>
          <p class="connect-service-services">${this.services}</p>
        </div>
        <button
          class=${classMap({
            "connect-services-button": true,
            primary: !this.connected,
            connected: this.connected,
          })}
          ?disabled=${this.authenticating}
          @click=${this.connectService}
        >
          ${this.getString(this.connectButtonLabelId)}
        </button>
      </div>
    `;
  }
}
customElements.define(
  "connect-service-notification",
  ConnectServiceNotification
);
