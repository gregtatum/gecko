/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  query,
  LitElement,
} from "chrome://browser/content/companion/lit.all.js";

export function openMeeting(e) {
  e.preventDefault();
  window.CompanionUtils.sendAsyncMessage("Companion:PauseAllMedia");
  window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
    url: e.currentTarget.href,
  });
}

export function openLink(e) {
  e.preventDefault();
  window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
    url: e.currentTarget.href,
  });
}

/**
 * MozLitElement provides extensions to the lit-provided LitElement class.
 *
 *******
 *
 * `@query` support (define a getter for a querySelector):
 *
 * static get queries() {
 *   return {
 *     propertyName: ".aNormal .cssSelector",
 *   };
 * }
 *
 * This example would add a property that would be written like this without
 * using `queries`:
 *
 * get propertyName() {
 *   return this.renderRoot?.querySelector(".aNormal .cssSelector");
 * }
 *
 *******
 *
 * Automatic Fluent support for shadow DOM.
 *
 * Fluent requires that a shadowRoot be connected before it can use Fluent.
 * Shadow roots will get connected automatically.
 */
export class MozLitElement extends LitElement {
  constructor() {
    super();
    let { queries } = this.constructor;
    if (queries) {
      for (let [name, selector] of Object.entries(queries)) {
        query(selector)(this, name);
      }
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this._l10nRootConnected) {
      document.l10n.connectRoot(this.renderRoot);
      this._l10nRootConnected = true;
    }
  }
}
