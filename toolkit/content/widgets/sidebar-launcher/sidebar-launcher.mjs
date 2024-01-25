/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, styleMap } from "../vendor/lit.all.mjs";
import { MozLitElement } from "../lit-utils.mjs";

// eslint-disable-next-line
// import "chrome://global/content/elements/moz-button.mjs";

const TAB_EVENTS = new Set([
  "TabSelect",
  "TabAttrModified",
  "TabClose",
  "TabMove",
  "TabOpen",
  "TabPinned",
  "TabUnpinned",
]);

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
    tabs: { type: Array },
  };

  static queries = {
    selectedTab: ".open-tabs button[selected]",
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
        l10nId: "sidebar-launcher-now",
        icon: `url("chrome://browser/content/firefoxview/sparkles.svg")`,
        view: "viewNowSidebar",
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
      {
        l10nId: "sidebar-launcher-genaidebug",
        icon: `url("chrome://browser/skin/tab-crashed.svg")`,
        view: "viewGenaiDebugSidebar",
      },
    ];

    this.bottomActions = [];

    this.selectedView = window.SidebarUI.currentID;
    this.open = window.SidebarUI.isOpen;
    this.tabs = window.gBrowser.tabs;
  }

  connectedCallback() {
    super.connectedCallback();
    this._sidebarBox = document.getElementById("sidebar-box");
    this._sidebarBox.addEventListener("sidebar-show", this);
    this._sidebarBox.addEventListener("sidebar-hide", this);
    this._sidebarMenu = document.getElementById("viewSidebarMenu");
    let menuMutationObserver = new MutationObserver(() =>
      this.#setExtensionItems()
    );
    menuMutationObserver.observe(this._sidebarMenu, {
      childList: true,
      subtree: true,
    });
    this.#setExtensionItems();
    for (let eventName of TAB_EVENTS.values()) {
      window.gBrowser.tabContainer.addEventListener(eventName, this);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._sidebarBox.removeEventListener("sidebar-show", this);
    this._sidebarBox.removeEventListener("sidebar-hide", this);
    for (let eventName of TAB_EVENTS.values()) {
      window.gBrowser.tabContainer.removeEventListener(eventName, this);
    }
  }

  getImageUrl(icon, targetURI) {
    if (window.IS_STORYBOOK) {
      return `chrome://global/skin/icons/defaultFavicon.svg`;
    }
    if (!icon) {
      if (targetURI?.startsWith("moz-extension")) {
        return "chrome://mozapps/skin/extensions/extension.svg";
      }
      return `chrome://global/skin/icons/defaultFavicon.svg`;
    }
    // If the icon is not for website (doesn't begin with http), we
    // display it directly. Otherwise we go through the page-icon
    // protocol to try to get a cached version. We don't load
    // favicons directly.
    if (icon.startsWith("http")) {
      return `page-icon:${targetURI}`;
    }
    return icon;
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
    if (TAB_EVENTS.has(e.type)) {
      this.tabSelectEvent = this.tabSelectEvent || e.type == "TabSelect" || e.type == "TabOpen";
      this.tabs = window.gBrowser.tabs;
      this.requestUpdate();
      return;
    }

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

  updated() {
    if (this.tabSelectEvent) {
      this.selectedTab.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    this.tabSelectEvent = false;
  }

  showView(e) {
    window.SidebarUI.toggle(e.target.getAttribute("view"));
  }

  buttonType(action) {
    return this.open && action.view == this.selectedView
      ? "icon"
      : "icon ghost";
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://global/content/elements/sidebar-launcher.css"
      />
      <link
        rel="stylesheet"
        href="chrome://global/skin/in-content/common.css"
      />
      <div class="wrapper">
        <div class="top-actions">
          ${this.topActions.map(
            action =>
              html`<button
                class="ghost-button icon-button"
                ?selected=${this.open && action.view == this.selectedView}
                type=${this.buttonType(action)}
                @click=${this.showView}
                view=${action.view}
                data-l10n-id=${action.l10nId}
                style=${styleMap({ "--action-icon": action.icon })}
              ></button>`
          )}
        </div>
        <div class="open-tabs">
          ${this.tabs.map(
            t => html`
              <button
                class="ghost-button icon-button"
                ?selected=${t.selected}
                @click=${() => (gBrowser.selectedTab = t)}
                title=${t.label}
                style=${styleMap({
                  "--action-icon": `url("${this.getImageUrl(
                    t.getAttribute("image"),
                    t.linkedBrowser?.currentURI?.spec
                  )}")`,
                })}
              ></button>
            `
          )}
        </div>
        <button
          class="ghost-button icon-button"
          @click=${event => BrowserOpenTab({ event })}
          title="Open a new tab"
          style=${styleMap({
            "--action-icon": `url(chrome://global/skin/icons/plus.svg)`,
          })}
        ></button>
        <div class="bottom-actions" ?empty=${!this.bottomActions.length}>
          ${this.bottomActions.map(
            action =>
              html`<button
                class="ghost-button icon-button"
                ?selected=${this.open && action.view == this.selectedView}
                type=${this.buttonType(action)}
                @click=${this.showView}
                view=${action.view}
                .tooltiptext=${action.tooltiptext}
                title=${action.tooltiptext}
                style=${styleMap({ "--action-icon": action.icon })}
              ></button>`
          )}
        </div>
      </div>
    `;
  }
}
customElements.define("sidebar-launcher", SidebarLauncher);
