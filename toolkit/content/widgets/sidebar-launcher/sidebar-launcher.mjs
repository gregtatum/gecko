/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, ifDefined, styleMap } from "../vendor/lit.all.mjs";
import { MozLitElement } from "../lit-utils.mjs";

// eslint-disable-next-line
import "chrome://global/content/elements/panel-list.js";
// import "chrome://global/content/elements/moz-button.mjs";

const SIDE_VIEW_AMO_URL = "addons.mozilla.org/en-US/firefox/addon/side-view/";
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
    expanded: { type: Boolean },
  };

  static queries = {
    selectedTab: ".open-tabs button[selected]",
    pinnedTabMenu: "#pinned-tab-menu",
    pinnedTabMenuSidebarItem: "#pinned-tab-open-sidebar",
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
        l10nId: "sidebar-launcher-genaidebug",
        icon: `url("chrome://browser/skin/tab-crashed.svg")`,
        view: "viewGenaiDebugSidebar",
      },
      {
        l10nId: "sidebar-launcher-side-view",
        icon: "url(chrome://global/skin/icons/plus.svg)",
        view: "@side-view",
      },
    ];

    this.bottomActions = [
      {
        l10nId: "sidebar-launcher-history",
        icon: `url("chrome://browser/content/firefoxview/category-history.svg")`,
        view: "viewHistorySidebar",
      },
      {
        l10nId: "sidebar-launcher-bookmarks",
        icon: `url("chrome://browser/skin/bookmark-hollow.svg")`,
        view: "viewBookmarksSidebar",
      },
      {
        l10nId: "sidebar-launcher-downloads",
        icon: `url("chrome://browser/skin/downloads/downloads.svg")`,
        view: null,
      },
      {
        l10nId: "sidebar-launcher-syncedtabs",
        icon: `url("chrome://browser/skin/device-phone.svg")`,
        view: "viewSyncedTabsSidebar",
      },
      {
        l10nId: "sidebar-launcher-account",
        icon: `url("chrome://browser/skin/fxa/avatar-empty.svg")`,
        view: null,
      },
    ];

    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "expandOnHover",
      "browser.sidebar-launcher.expand-on-hover.enabled",
      false
    );
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "expandOnHoverDelay",
      "browser.sidebar-launcher.expand-on-hover.delay",
      500
    );

    this.expanded = false;
    this.selectedView = window.SidebarUI.currentID;
    this.open = window.SidebarUI.isOpen;
    this.updateTabs();
  }

  connectedCallback() {
    super.connectedCallback();
    this._sidebarBox = document.getElementById("sidebar-box");
    this._sidebarBox.addEventListener("sidebar-show", this);
    this._sidebarBox.addEventListener("sidebar-hide", this);
    this._sidebarMenu = document.getElementById("viewSidebarMenu");
    // let menuMutationObserver = new MutationObserver(() =>
    //   this.#setExtensionItems()
    // );
    // menuMutationObserver.observe(this._sidebarMenu, {
    //   childList: true,
    //   subtree: true,
    // });
    // this.#setExtensionItems();
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

  updateTabs() {
    this.pinnedTabs = window.gBrowser.tabs.filter(t => t.pinned && !t.closing);
    this.tabs = window.gBrowser.tabs.filter(t => !t.pinned && !t.closing);
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

  // #setExtensionItems() {
  //   this.bottomActions = [];
  //   for (let item of this._sidebarMenu.children) {
  //     if (item.id.endsWith("-sidebar-action")) {
  //       this.bottomActions.push({
  //         tooltiptext: item.label,
  //         icon: item.style.getPropertyValue("--webextension-menuitem-image"),
  //         view: item.id.slice("menubar_menu_".length),
  //       });
  //     }
  //   }
  // }

  handleEvent(e) {
    if (TAB_EVENTS.has(e.type)) {
      this.tabSelectEvent =
        this.tabSelectEvent || e.type == "TabSelect" || e.type == "TabOpen";
      this.updateTabs();
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
    let view = e.target.getAttribute("view");
    if (view.startsWith("@")) {
      window.gBrowser.addTab(SIDE_VIEW_AMO_URL, {
        inBackground: false,
        triggeringPrincipal:
          window.Services.scriptSecurityManager.getSystemPrincipal(),
      });
    } else if (!this.expandOnHover && view == "viewHomeSidebar") {
      this.expanded = !this.expanded;
    } else {
      window.SidebarUI.toggle(view);
    }
  }

  buttonType(action) {
    return this.open && action.view == this.selectedView
      ? "icon"
      : "icon ghost";
  }

  onTabClick(e) {
    let { tab } = e.target;
    if (tab.pinned) {
      let { selectedTab } = gBrowser;
      gBrowser.selectedTab = tab;
      document
        .getElementById("pageAction-urlbar-side-view_mozilla_org")
        .click();
      gBrowser.selectedTab = selectedTab;
    } else {
      gBrowser.selectedTab = tab;
    }
  }

  onTabContextmenu(e) {
    let { tab } = e.target;
    if (!tab.pinned) {
      return;
    }
    this.pinnedTabMenuSidebarItem.checked = tab._openInSidebar;
    this.pinedTabMenu.toggle(e);
  }

  onAddTabClick(event) {
    BrowserOpenTab({ event, index: 0 });
  }

  onCloseClick(event) {
    gBrowser.removeTab(event.target.tab);
  }

  onTabMouseenter(e) {
    if (!e.target.tab.pinned) {
      const previewContainer = document.getElementById(
        "tabbrowser-tab-preview"
      );
      previewContainer.anchor = e.target;
      previewContainer.tab = e.target.tab;
    }
  }

  onTabMouseleave(e) {
    const previewContainer = document.getElementById("tabbrowser-tab-preview");
    previewContainer.anchor = null;
    previewContainer.tab = null;
  }

  onWrapperMouseenter(e) {
    if (!this.expandOnHover) {
      return;
    }
    if (!this._wrapperMouseenterTimeout) {
      this._wrapperMouseenterTimeout = setTimeout(() => {
        this.expanded = true;
        this._wrapperMouseenterTimeout = null;
      }, this.expandOnHoverDelay);
    }
    clearTimeout(this._wrapperMouseleaveTimeout);
    this._wrapperMouseleaveTimeout = null;
  }

  onWrapperMouseleave(e) {
    if (!this.expandOnHover) {
      return;
    }
    if (this._wrapperMouseenterTimeout) {
      // If we haven't opened yet then cancel opening.
      clearTimeout(this._wrapperMouseenterTimeout);
      this._wrapperMouseenterTimeout = null;
      this.expanded = false;
      return;
    }
    if (!this._wrapperMouseleaveTimeout) {
      this._wrapperMouseleaveTimeout = setTimeout(() => {
        this.expanded = false;
        this._wrapperMouseleaveTimeout = null;
      }, this.expandOnHoverDelay);
    }
  }

  tabsTemplate(tabs) {
    return tabs.map(
      t => html`
        <div class="open-tab-wrapper">
          <button
            class="ghost-button icon-button"
            ?selected=${t.selected}
            @click=${this.onTabClick}
            @mouseenter=${this.onTabMouseenter}
            @mouseleave=${this.onTabMouseleave}
            .tab=${t}
            title=${ifDefined(t.pinned ? t.label : null)}
            style=${styleMap({
              "--action-icon": `url("${this.getImageUrl(
                t.getAttribute("image"),
                t.linkedBrowser?.currentURI?.spec
              )}")`,
            })}
          >
            ${this.expanded ? t.label : ""}
          </button>
          ${this.expanded && !t.pinned
            ? html`<button
                class="ghost-button icon-button close-tab-button"
                @click=${this.onCloseClick}
                .tab=${t}
                style=${styleMap({
                  "--action-icon": `url("chrome://global/skin/icons/close-12.svg")`,
                })}
                title="Close tab"
              ></button>`
            : ""}
        </div>
      `
    );
  }

  render() {
    this.toggleAttribute("expanded", this.expanded);
    return html`
      <link
        rel="stylesheet"
        href="chrome://global/content/elements/sidebar-launcher.css"
      />
      <link
        rel="stylesheet"
        href="chrome://global/skin/in-content/common.css"
      />
      <panel-list id="pinned-tab-menu">
        <panel-item id="pinned-tab-open-sidebar">Open in sidebar</panel-item>
      </panel-list>
      <div
        class="wrapper"
        @mouseenter=${this.onWrapperMouseenter}
        @mouseleave=${this.onWrapperMouseleave}
      >
        <div class="top-actions actions-list">
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
              >
                New shortcut
              </button>`
          )}
        </div>
        ${this.pinnedTabs.length
          ? html`
              <div class="open-tabs pinned-tabs actions-list top-border">
                ${this.tabsTemplate(this.pinnedTabs)}
              </div>
            `
          : ""}
        <div class="add-button-wrapper top-border">
          <button
            class="ghost-button icon-button sidebar-add-tab"
            @click=${this.onAddTabClick}
            @contextmenu=${this.onTabContextmenu}
            title="Open a new tab"
            style=${styleMap({
              "--action-icon": `url(chrome://global/skin/icons/plus.svg)`,
            })}
          >
            New tab
          </button>
        </div>
        <div class="open-tabs unpinned-tabs actions-list">
          ${this.tabsTemplate(this.tabs)}
        </div>
        <div class="bottom-actions actions-list">
          ${this.bottomActions.map(
            action =>
              html`<button
                class="ghost-button icon-button"
                data-l10n-id=${action.l10nId}
                ?selected=${this.open && action.view == this.selectedView}
                type=${this.buttonType(action)}
                @click=${action.view ? this.showView : null}
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
