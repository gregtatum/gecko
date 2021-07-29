/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "./widget-utils.js";
import { classMap, html, css } from "./lit.all.js";

const { OnlineServices } = ChromeUtils.import(
  "resource:///modules/OnlineServices.jsm"
);

export class RefreshServicesButton extends MozLitElement {
  static get properties() {
    return {
      isRefreshing: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://global/skin/in-content/common.css");

      .refresh-services-button {
        min-width: auto;
        width: 16px;
      }

      .refresh-services-button::after {
        content: "";
        display: block;
        background-image: url("chrome://browser/skin/sync.svg");
        background-repeat: no-repeat;
        background-size: 16px;
        fill: currentColor;
        height: 16px;
        width: 16px;
        /* Center icon by offsetting it 8px */
        margin-inline-start: -8px;
      }

      .refresh-services-button.syncing::after {
        animation-name: syncing;
        animation-duration: 500ms;
        animation-iteration-count: infinite;
        animation-timing-function: linear;
      }

      @media (prefers-reduced-motion: reduce) {
        .refresh-services-button.syncing {
          animation: none;
        }
      }

      @keyframes syncing {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `;
  }

  constructor() {
    super();
    this.isRefreshing = false;
  }

  async onClick() {
    this.isRefreshing = true;

    try {
      await OnlineServices.refreshEvents();
    } finally {
      this.isRefreshing = false;
    }
  }

  render() {
    return html`
      <button
        @click=${this.onClick}
        ?disabled=${this.isRefreshing}
        class=${classMap({
          "ghost-button": true,
          "refresh-services-button": true,
          syncing: this.isRefreshing,
        })}
        data-l10n-id=${this.isRefreshing
          ? "companion-refresh-services-button-syncing"
          : "companion-refresh-services-button"}
      ></button>
    `;
  }
}
customElements.define("refresh-services-button", RefreshServicesButton);
