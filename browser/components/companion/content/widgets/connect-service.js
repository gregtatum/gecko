/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import "./simple-notification.js";
import { MozLitElement } from "../widget-utils.js";
import { css, html, styleMap } from "../lit.all.js";

class ConnectServiceNotification extends MozLitElement {
  static get properties() {
    return {
      icon: { type: String },
      name: { type: String },
      description: { type: String },
      status: { type: String },
    };
  }

  static get queries() {
    return {
      connectButton: "button",
    };
  }

  static get styles() {
    return css`
      button {
        gap: 4px;
        margin: 0;
        flex-shrink: 0;
      }

      p {
        margin: 0;
      }

      .connected {
        display: flex;
        align-items: center;
      }

      .connected-icon {
        background: url("chrome://global/skin/icons/check.svg") no-repeat center;
        background-size: contain;
        height: 12px;
        width: 14px;
        margin-inline-end: 6px;
        -moz-context-properties: fill;
        fill: var(--icon-color-success);
      }
    `;
  }

  connectService() {
    if (this.status !== "connected") {
      this.connectServiceCallback();
    }
  }

  get connectButtonLabelId() {
    switch (this.status) {
      case "error":
        return "companion-onboarding-service-reconnect";
      case "authenticating":
        return "companion-onboarding-service-connecting";
      default:
        return "companion-onboarding-service-connect";
    }
  }

  connectStatusTemplate() {
    if (this.status == "connected") {
      return html`
        <div class="connected" slot="primary-action">
          <span
            class="connected-icon"
            style=${styleMap({
              "-moz-context-properties": "fill",
            })}
          ></span>
          <p
            class="text-body-m-med"
            data-l10n-id="companion-onboarding-service-connected"
          ></p>
        </div>
      `;
    }

    return html`
      <button
        slot="primary-action"
        class="primary"
        ?disabled=${this.status == "authenticating"}
        @click=${this.connectService}
        data-l10n-id=${this.connectButtonLabelId}
      ></button>
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

      <simple-notification
        .heading=${this.name}
        .icon=${this.icon}
        .description=${this.description}
      >
        ${this.connectStatusTemplate()}
      </simple-notification>
    `;
  }
}
customElements.define(
  "connect-service-notification",
  ConnectServiceNotification
);
