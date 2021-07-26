/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html } from "chrome://browser/content/companion/lit.all.js";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

class TopView extends MozLitElement {
  #principal;

  static get properties() {
    return {
      _viewGroup: { type: Array, state: true },
      activeView: { type: Object },
    };
  }

  constructor() {
    super();
    this._viewGroup = [
      {
        url: Services.io.newURI("about:blank"),
        title: "Newtab",
        iconURL: "chrome://global/skin/icons/defaultFavicon.svg",
      },
    ];
    this.#principal = Services.scriptSecurityManager.createNullPrincipal({});
  }

  addView(view) {
    this.activeView = null;

    if (
      !this.#principal.isSameOrigin(
        view.url,
        window.browsingContext.usePrivateBrowsing
      )
    ) {
      if (!this.#principal.isNullPrincipal) {
        let e = new CustomEvent("TopViewOverflow", {
          bubbles: true,
          composed: true,
          detail: { views: [...this._viewGroup] },
        });
        this.dispatchEvent(e);
      }

      this.#principal = Services.scriptSecurityManager.createContentPrincipal(
        view.url,
        {}
      );

      this._viewGroup = [view];
    } else {
      let index = this._viewGroup.indexOf(view);
      if (index != -1) {
        this._viewGroup.splice(index, 1);
      }
      this._viewGroup.push(view);
    }

    this.activeView = view;
    this.viewUpdated();
  }

  hasView(view) {
    return this._viewGroup.includes(view);
  }

  /**
   * For reasons that are unclear, if the _viewGroup Array has any of its
   * entries updated, and then requestUpdate is called, the <view-group>
   * won't reflect these changes. The workaround for now is to overwrite the
   * _viewGroup state variable and then request an update.
   */
  viewUpdated() {
    this._viewGroup = [...this._viewGroup];
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/components/top-view.css"
        type="text/css"
      />
      <view-group
        top="true"
        exportparts="domain, history"
        ?active=${this._viewGroup.includes(this.activeView)}
        .views=${this._viewGroup}
        .activeView=${this.activeView}
      ></view-group>
    `;
  }
}
customElements.define("top-view", TopView);
