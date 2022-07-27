/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "./widget-utils.js";
import { css, html } from "./lit.all.js";

class SectionPanel extends MozLitElement {
  static properties = {
    l10nId: { attribute: "heading-l10n-id", type: String },
  };
  static get styles() {
    return css`
      .section-panel-header {
        display: flex;
        padding: 24px 0 16px;
        /* Center the heading. Back button is 16px+24px+16px. */
        padding-inline-end: 56px;
      }

      .section-panel-heading {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-grow: 1;
      }

      .section-panel-header-button {
        flex-grow: 0;
        flex-shrink: 0;
        margin-inline: 16px;
        width: 24px;
        height: 24px;
        min-height: auto;
        padding: 0;
      }

      .section-panel-content {
        min-height: 0;
      }
    `;
  }

  static get queries() {
    return {
      backButton: ".back-button",
    };
  }

  goBack(e) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("section-panel-back", {
        bubbles: true,
        detail: {
          isKeyboardSource: e.mozInputSource == MouseEvent.MOZ_SOURCE_KEYBOARD,
        },
      })
    );
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

      <div class="section-panel-header" part="header">
        <button
          class="section-panel-header-button back-button ghost-button"
          data-l10n-id="companion-header-back-button"
          @click=${this.goBack}
        ></button>
        <span class="section-panel-heading">
          <h1 class="text-heading-m-med" data-l10n-id="${this.l10nId}"></h1>
        </span>
      </div>
      <div class="section-panel-content">
        <slot></slot>
      </div>
    `;
  }
}
customElements.define("section-panel", SectionPanel);
