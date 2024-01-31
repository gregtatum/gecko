/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";

// eslint-disable-next-line import/no-unassigned-import
import "chrome://global/content/elements/moz-card.mjs";

class HomeSidebar extends MozLitElement {
  static properties = {};

  static styles = css``;

  constructor() {
    super();
    this.parentWindow = window.docShell.chromeEventHandler.ownerGlobal;
    this.gBrowser = this.parentWindow.gBrowser;
  }

  render() {
    return html`<moz-card heading="Home"></moz-card>`;
  }
}
customElements.define("home-sidebar", HomeSidebar);
