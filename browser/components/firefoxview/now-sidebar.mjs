/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

// eslint-disable-next-line import/no-unassigned-import
import "chrome://global/content/elements/moz-card.mjs";

class NowSidebar extends MozLitElement {
  static properties = {
    notifications: { type: Array },
  };

  static queries = {
    textPromptEl: "textarea",
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .footer-button {
      margin: 0 !important;
    }

    .prompts {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .assistant-text-prompt {
      display: flex;
      align-items: stretch;
      gap: 4px;
      margin-top: 4px;

      & > textarea {
        padding: 4px;
        flex-grow: 1;
        border: 1px solid var(--border-interactive-color);
        border-radius: var(--button-border-radius);
      }

      & > button {
        background-image: url("chrome://browser/skin/forward.svg");
        background-position: center;
        background-repeat: no-repeat;
        width: 32px;
      }
    }
  `;

  constructor() {
    super();
    this.parentWindow = window.docShell.chromeEventHandler.ownerGlobal;
    this.gBrowser = this.parentWindow.gBrowser;
    this.notifications = [];
  }

  addNotification(notif) {
    this.notifications.push(notif);
    this.requestUpdate();
  }

  summarize() {
    this.addNotification({
      heading: `Summary of ${this.gBrowser.selectedTab.label}`,
      content: "It's a page about some stuff",
    });
  }

  email() {
    let title = this.gBrowser.selectedTab.label;
    let url = this.gBrowser.selectedBrowser?.currentURI?.spec;

    this.gBrowser.addTab(
      `mailto:,subject=${title},body=Check out this site I found about ${title}: ${url}`
    );
  }

  cafes() {}
  save() {}

  textPrompt(e) {
    let text = this.textPromptEl.value;
    if (!text) {
      return;
    }
    this.addNotification({
      heading: text,
      content: "Loading...",
    });
    this.textPromptEl.value = "";
  }

  render() {
    return html`
      <link rel="stylesheet" href="chrome://global/skin/global.css" />
      <moz-card heading="Now view">
        <p>
          the current tab's URL is
          <b>${this.gBrowser.selectedBrowser.currentURI.spec}</b>
        </p>
        <p>any component in this page could access the current page info</p>
      </moz-card>
      <moz-card heading="Firefox Assistant">
        <p>Firefox Assistant can help with tasks on this page.</p>
        <div class="prompts">
          <button class="footer-button small-button" @click=${this.summarize}>
            Summarize content
          </button>
          <button class="footer-button small-button" @click=${this.email}>
            Email this page
          </button>
          <button class="footer-button small-button" @click=${this.cafes}>
            Find best cafes in Tokyo
          </button>
          <button class="footer-button small-button" @click=${this.save}>
            Save to "Tokyo" bookmark folder
          </button>
        </div>
        <div class="assistant-text-prompt">
          <textarea
            placeholder="Give me a task related to this page or ask follow up question"
          ></textarea>
          <button class="footer-button" @click=${this.textPrompt}></button>
        </div>
      </moz-card>
      ${this.notifications.map(
        notif => html`
          <moz-card .heading=${notif.heading}>
            <p>${notif.content}</p>
          </moz-card>
        `
      )}
    `;
  }
}
customElements.define("now-sidebar", NowSidebar);
