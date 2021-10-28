/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from ../../preferences/preferences.js */

import { MozLitElement } from "./widget-utils.js";
import { classMap, html, css } from "./lit.all.js";
import { workshopAPI } from "./workshopAPI.js";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

ChromeUtils.defineModuleGetter(
  globalThis,
  "OnlineServices",
  "resource:///modules/OnlineServices.jsm"
);

export class RefreshServicesButton extends MozLitElement {
  static get properties() {
    return {
      isRefreshing: { type: Boolean },
      servicesConnected: { type: Boolean },
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
    this.updateServicesConnected = this.updateServicesConnected.bind(this);
    this.updateServicesConnected();
  }

  updateServicesConnected() {
    this.servicesConnected = !!OnlineServices.getAllServices().length;
  }

  connectedCallback() {
    Services.obs.addObserver(this.updateServicesConnected, "companion-signin");
    Services.obs.addObserver(this.updateServicesConnected, "companion-signout");
    super.connectedCallback();
  }

  disconnectedCallback() {
    Services.obs.removeObserver(
      this.updateServicesConnected,
      "companion-signin"
    );
    Services.obs.removeObserver(
      this.updateServicesConnected,
      "companion-signout"
    );
    super.connectedCallback();
  }

  async onClick() {
    this.isRefreshing = true;

    try {
      if (Services.prefs.getBoolPref("browser.pinebuild.workshop.enabled")) {
        await new Promise(resolve => {
          // Wait for the list view to finish syncing by checking its sync
          // status. However, MR2-1182 will be adding a method that refreshes
          // all subscribed calendars in a single call and we can avoid having
          // to do all these extra steps below.
          let spec = OnlineServices.getCalendarEventQuery();
          let listView = workshopAPI.searchAllMessages(spec);
          listView.refresh();
          listView.seekToTop(10, 990);
          listView.on("seeked", this, () => {
            if (!listView.tocMeta.syncStatus) {
              resolve();
            }
          });
        });
      } else {
        await OnlineServices.fetchEvents();
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  render() {
    return html`
      <button
        ?hidden=${!this.servicesConnected}
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
