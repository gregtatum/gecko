/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html } from "chrome://browser/content/companion/lit.all.js";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { PanelMultiView } = ChromeUtils.import(
  "resource:///modules/PanelMultiView.jsm"
);

class TopView extends MozLitElement {
  #principal;
  #pageActionPanel;

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

  handleEvent(event) {
    switch (event.type) {
      case "popupshowing":
        if (event.target == this.#pageActionPanel) {
          this.pageActionPanelShowing();
        }
        break;
      case "click":
        if (event.currentTarget == this.#pageActionPanel) {
          this.#pageActionPanel.hidePopup();
        }
        break;
    }
  }

  pageActionPanelShowing() {
    let pageActionTitleEl = document.getElementById("site-info-title");
    pageActionTitleEl.textContent = this.activeView.title;

    let pageActionUrlEl = document.getElementById("site-info-url");
    pageActionUrlEl.textContent = this.activeView.url.spec;
  }

  getOrCreatePageActionPanel() {
    let panel = document.getElementById("page-action-panel");
    if (!panel) {
      let template = document.getElementById("template-page-action-menu");
      template.replaceWith(template.content);
      panel = document.getElementById("page-action-panel");
      panel.addEventListener("popupshowing", this);
      panel.addEventListener("click", this);
    }

    return panel;
  }

  pageActionButtonClicked(event) {
    this.#pageActionPanel = this.getOrCreatePageActionPanel();
    PanelMultiView.openPopup(this.#pageActionPanel, event.target, {
      position: "bottomcenter topright",
    }).catch(Cu.reportError);
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
      <img id="page-action-button"
           src="chrome://global/skin/icons/arrow-down.svg"
           @click="${this.pageActionButtonClicked}"
      ></img>`;
  }
}
customElements.define("top-view", TopView);
