/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, styleMap } from "../vendor/lit.all.mjs";
import { MozLitElement } from "../lit-utils.mjs";

// eslint-disable-next-line
import "chrome://global/content/elements/moz-button.mjs";

/**
 * Component description goes here.
 *
 * @tagname sidebar-launcher
 * @property {string} variant - Property description goes here
 */
export default class SidebarLauncher extends MozLitElement {
  static properties = {
    topActions: { type: Array },
    bottomActions: { type: Array },
    selectedView: { type: String },
    open: { type: Boolean },
  };

  constructor() {
    super();
    this.topActions = [
      {
        l10nId: "sidebar-launcher-home",
        icon: `url("chrome://browser/content/firefoxview/category-opentabs.svg")`,
        view: "viewHomeSidebar",
      },
      {
        l10nId: "sidebar-launcher-bookmarks",
        icon: `url("chrome://browser/skin/bookmark-hollow.svg")`,
        view: "viewBookmarksSidebar",
      },
      {
        l10nId: "sidebar-launcher-history",
        icon: `url("chrome://browser/content/firefoxview/category-history.svg")`,
        view: "viewHistorySidebar",
      },
      {
        l10nId: "sidebar-launcher-syncedtabs",
        icon: `url("chrome://browser/content/firefoxview/category-syncedtabs.svg")`,
        view: "viewTabsSidebar",
      },
    ];

    this.bottomActions = [];

    this.selectedView = window.SidebarUI.currentID;
    this.open = window.SidebarUI.isOpen;
  }

  connectedCallback() {
    super.connectedCallback();
    this._sidebarBox = document.getElementById("sidebar-box");
    this._sidebarBox.addEventListener("sidebar-show", this);
    this._sidebarBox.addEventListener("sidebar-hide", this);
    this._sidebarMenu = document.getElementById("viewSidebarMenu");
    let menuMutationObserver = new MutationObserver(() => this.#setExtensionItems());
    menuMutationObserver.observe(this._sidebarMenu, { childList: true, subtree: true });
    this.#setExtensionItems();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._sidebarBox.removeEventListener("sidebar-show", this);
    this._sidebarBox.removeEventListener("sidebar-hide", this);
  }

  #setExtensionItems() {
    this.bottomActions = [];
    for (let item of this._sidebarMenu.children) {
      if (item.id.endsWith("-sidebar-action")) {
        this.bottomActions.push({
          tooltiptext: item.label,
          icon: item.style.getPropertyValue("--webextension-menuitem-image"),
          view: item.id.slice("menubar_menu_".length),
        });
      }
    }
  }

  handleEvent(e) {
    switch (e.type) {
      case "sidebar-show":
        this.selectedView = e.detail.viewId;
        this.open = true;
        break;
      case "sidebar-hide":
        this.open = false;
        break;
    }
  }

  showView(e) {
    window.SidebarUI.toggle(e.target.getAttribute("view"));
  }

  buttonType(action) {
    return this.open && action.view == this.selectedView ? "icon" : "icon ghost";
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://global/content/elements/sidebar-launcher.css"
      />
      <div class="wrapper">
        <div class="top-actions">
          ${this.topActions.map(
            action =>
              html`<moz-button
                type=${this.buttonType(action)}
                @click=${this.showView}
                view=${action.view}
                data-l10n-id=${action.l10nId}
                style=${styleMap({ "--action-icon": action.icon })}
              ></moz-button>`
          )}
        </div>
        <div class="bottom-actions">
          ${this.bottomActions.map(
            action =>
              html`<moz-button
                type=${this.buttonType(action)}
                @click=${this.showView}
                view=${action.view}
                .tooltiptext=${action.tooltiptext}
                style=${styleMap({ "--action-icon": action.icon })}
              ></moz-button>`
          )}
        </div>
      </div>
    `;
  }
}
customElements.define("sidebar-launcher", SidebarLauncher);
