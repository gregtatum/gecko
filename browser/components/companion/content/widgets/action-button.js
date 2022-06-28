/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "../widget-utils.js";
import { css, html } from "../lit.all.js";

export class ActionButton extends MozLitElement {
  static get properties() {
    return {
      icon: { type: String },
      label: { type: String },
      disabled: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      .action-button {
        appearance: none;
        background: none;
        border: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        width: fit-content;
        max-width: 62px;
        cursor: pointer;
      }

      .action-button:focus-visible {
        outline: none;
      }

      .action-button:focus-visible > .action-button-icon-container {
        outline: 2px solid var(--focus-outline-color);
      }

      .action-button-icon-container {
        box-sizing: border-box;
        height: 32px;
        width: 32px;
        border-radius: 100px;
        background-color: var(--action-button-background);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0.5px solid var(--action-button-border-color);
      }

      .action-button-icon {
        width: 15px;
        height: auto;
        -moz-context-properties: fill;
        fill: var(--icon-color-default);
      }

      .action-button-label {
        margin-block-start: 6px;
        color: var(--pine-text-color-secondary);
      }

      .action-button:not([disabled]):hover > .action-button-icon-container {
        background-color: var(--action-button-background-hover);
        border-color: var(--action-button-border-color-hover);
      }

      .action-button:not([disabled]):active > .action-button-icon-container {
        background-color: var(--action-button-background-active);
      }

      .action-button:disabled .action-button-icon {
        fill: var(--icon-color-disabled);
      }

      .action-button:disabled .action-button-label {
        color: var(--pine-text-color-disabled);
      }
    `;
  }

  constructor() {
    super();
    this.icon = "";
    this.label = "";
    this.disabled = false;
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/fonts.css"
      />
      <button ?disabled=${this.disabled} class="action-button">
        <div class="action-button-icon-container">
          <img
            class="action-button-icon"
            src=${this.icon}
            role="presentation"
          />
        </div>
        <span
          class="action-button-label text-body-xs"
          data-l10n-id=${this.label}
        ></span>
      </button>
    `;
  }
}

customElements.define("action-button", ActionButton);
