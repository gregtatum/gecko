/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import "./simple-notification.js";
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
      connectButton: "button",
    };
  }

  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");

      button {
        /* flex for the green connected dot. */
        display: flex;
        align-items: center;
        gap: 4px;
        margin: 0;
        flex-shrink: 0;
      }

      button.connected::before {
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
      <simple-notification
        .heading=${this.name}
        .icon=${this.icon}
        .description=${this.services}
      >
        <button
          slot="primary-button"
          class=${classMap({
            primary: !this.connected,
            connected: this.connected,
          })}
          ?disabled=${this.authenticating}
          @click=${this.connectService}
          data-l10n-id=${this.connectButtonLabelId}
        ></button>
      </simple-notification>
    `;
  }
}
customElements.define(
  "connect-service-notification",
  ConnectServiceNotification
);
