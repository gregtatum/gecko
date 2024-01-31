/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, ifDefined, styleMap } from "../vendor/lit.all.mjs";
import { MozLitElement } from "../lit-utils.mjs";

// eslint-disable-next-line
// import "chrome://global/content/elements/moz-button.mjs";

const COLLAPSE_ICON_URL = `url("chrome://global/skin/icons/collapse.svg")`;
const EXPAND_ICON_URL = `url("chrome://global/skin/icons/expand.svg")`;
const SIDE_VIEW_AMO_URL = "addons.mozilla.org/en-US/firefox/addon/side-view/";
const SIDE_VIEW_VIEW_ID = "side-view_mozilla_org-sidebar-action";
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
    expandedPinned: { type: Boolean },
    lastSideViewTab: { type: Object },
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
        l10nId: "sidebar-launcher-now",
        icon: "url(chrome://global/skin/icons/insights.svg)",
        view: "viewNowSidebar",
      },

      {
        l10nId: "sidebar-launcher-genaidebug",
        icon: "url(chrome://global/skin/icons/developer.svg)",
        view: "viewGenaiDebugSidebar",
      },
      {
        l10nId: "sidebar-launcher-side-view",
        icon: "url(chrome://global/skin/icons/side-view.svg)",
        view: SIDE_VIEW_VIEW_ID,
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
        view: "viewDownloadsSidebar",
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
    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "keepTabOnShortcut",
      "browser.sidebar-launcher.keep-tab-on-shortcut.enabled",
      false
    );
    this.extensions = [];
    this.expanded = false;
    this.expandedPinned = false;
    this.sideViewInstalled = false;
    this.selectedView = window.SidebarUI.currentID;
    this.open = window.SidebarUI.isOpen;
    this.updateTabs();
    this.menuMutationObserver = new MutationObserver(() =>
      this.#setExtensionItems()
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this._sidebarBox = document.getElementById("sidebar-box");
    this._sidebarBox.addEventListener("sidebar-show", this);
    this._sidebarBox.addEventListener("sidebar-hide", this);
    this._sidebarMenu = document.getElementById("viewSidebarMenu");

    this.menuMutationObserver.observe(this._sidebarMenu, {
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
    this.menuMutationObserver.disconnect();
  }

  get sideViewIsOpen() {
    return (
      window.SidebarUI.isOpen && window.SidebarUI.currentID == SIDE_VIEW_VIEW_ID
    );
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

  #setExtensionItems() {
    this.extensions = [];
    for (let item of this._sidebarMenu.children) {
      this.sideViewInstalled =
        this.sideViewInstalled ||
        item.id.slice("menubar_menu_".length) == SIDE_VIEW_VIEW_ID;
      if (item.id.endsWith("-sidebar-action") && !item.id.endsWith(SIDE_VIEW_VIEW_ID)) {
        this.extensions.push({
          tooltiptext: item.label,
          icon: item.style.getPropertyValue("--webextension-menuitem-image"),
          view: item.id.slice("menubar_menu_".length),
        });
      }
    }
  }

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

  get expandIconUrl() {
    if (this.expandOnHover) {
      return this.expandedPinned ? COLLAPSE_ICON_URL : EXPAND_ICON_URL;
    }
    return this.expanded ? COLLAPSE_ICON_URL : EXPAND_ICON_URL;
  }

  get expandText() {
    if (this.expandOnHover) {
      return this.expandedPinned ? "Collapse" : "Keep expanded";
    }
    return this.expanded ? "Collapse" : "Expand";
  }

  showView(e) {
    let view = e.target.getAttribute("view");
    if (view == SIDE_VIEW_VIEW_ID && !this.sideViewInstalled) {
      window.gBrowser.addTab(SIDE_VIEW_AMO_URL, {
        inBackground: false,
        triggeringPrincipal:
          window.Services.scriptSecurityManager.getSystemPrincipal(),
      });
    } else {
      window.SidebarUI.toggle(view);
    }
  }

  toggleExpanded() {
    if (this.expandOnHover) {
      this.expanded = this.expandedPinned = !this.expandedPinned;
    } else {
      this.expanded = !this.expanded;
    }
  }

  buttonType(action) {
    return this.open && action.view == this.selectedView
      ? "icon"
      : "icon ghost";
  }

  onAddShortcutClick(e) {
    if (this.keepTabOnShortcut) {
      // This is not the default case.
      let existingTab = gBrowser.selectedTab;
      let duplicateTab = gBrowser.duplicateTab(existingTab, true);
      gBrowser.pinTab(existingTab);
      this.showTab(existingTab);
      gBrowser.selectedTab = duplicateTab;
    } else {
      // This is the default case.
      let tabToPin = gBrowser.selectedTab;
      let tabToFocus = gBrowser.selectedTab.nextElementSibling;
      if (tabToFocus?.localName != "tab" || tabToFocus.pinned) {
        tabToFocus = gBrowser.selectedTab.previousElementSibling;
        if (tabToFocus?.localName != "tab" || tabToFocus.pinned) {
          tabToFocus = null;
        }
      }
      gBrowser.pinTab(tabToPin);
      if (tabToFocus) {
        gBrowser.selectedTab = tabToFocus;
      } else {
        this.onAddTabClick(e);
      }
      this.showTab(tabToPin);
    }
  }

  onTabClick(e) {
    this.showTab(e.target.tab);
  }

  showTab(tab) {
    if (tab.pinned) {
      this.lastSideViewTab = tab;
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
    if (!this.expandOnHover || this.expandedPinned) {
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
    if (!this.expandOnHover || this.expandedPinned) {
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
            ?selected=${t.pinned
              ? this.sideViewIsOpen && t == this.lastSideViewTab
              : t.selected}
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
      <div
        class="wrapper"
        @mouseenter=${this.onWrapperMouseenter}
        @mouseleave=${this.onWrapperMouseleave}
      >
        <div class="expand-button-wrapper">
          <button
            class="ghost-button icon-button"
            @click=${this.toggleExpanded}
            style=${styleMap({ "--action-icon": this.expandIconUrl })}
          >
            ${this.expandText}
          </button>
        </div>
        <div class="top-actions actions-list top-border">
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
        <div class="open-tabs pinned-tabs actions-list top-border">
          ${this.pinnedTabs.length
            ? html` ${this.tabsTemplate(this.pinnedTabs)} `
            : ""}
          ${this.extensions.length
            ? this.extensions.map(
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
              )
            : null}

          <button
            class="ghost-button icon-button add-shortcut"
            title="Add a shortcut"
            @click=${this.onAddShortcutClick}
            style=${styleMap({
              "--action-icon": "url(chrome://global/skin/icons/plus.svg)",
            })}
          >
            Add a shortcut
          </button>
        </div>
        <div class="add-button-wrapper top-border">
          <button
            class="ghost-button icon-button sidebar-add-tab"
            @click=${this.onAddTabClick}
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
