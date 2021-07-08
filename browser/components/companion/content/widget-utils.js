/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as lit from "chrome://browser/content/companion/lit.all.js";
export const { html, css } = lit;

export function openLink(e) {
  e.preventDefault();
  window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
    url: e.target.href,
  });
}

export class MozLitElement extends lit.LitElement {
  connectedCallback() {
    super.connectedCallback();
    if (!this._l10nRootConnected) {
      document.l10n.connectRoot(this.renderRoot);
      this._l10nRootConnected = true;
    }
  }
}
