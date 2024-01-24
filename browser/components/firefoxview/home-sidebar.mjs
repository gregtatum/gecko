/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import {
  classMap,
  css,
  html,
  map,
  when,
} from "chrome://global/content/vendor/lit.all.mjs";
import { MozLitElement } from "chrome://global/content/lit-utils.mjs";
import "./fxview-tab-list.mjs";

function getTabListItems(tabs) {
  return tabs
    ?.filter(tab => !tab.closing && !tab.hidden && !tab.pinned)
    .map(tab => ({
      icon: tab.getAttribute("image"),
      primaryL10nId: "firefoxview-opentabs-tab-row",
      primaryL10nArgs: JSON.stringify({
        url: tab.linkedBrowser?.currentURI?.spec,
      }),
      secondaryL10nId: "fxviewtabrow-options-menu-button",
      secondaryL10nArgs: JSON.stringify({ tabTitle: tab.label }),
      tabElement: tab,
      title: tab.label,
      url: tab.linkedBrowser?.currentURI?.spec,
    }));
}

class HomeSidebar extends MozLitElement {
  static properties = {
    tabs: { type: Array },
  };

  static styles = css`
    fxview-tab-list::part(secondary-button) {
      background-image: url("chrome://global/skin/icons/close.svg");
    }

    fxview-tab-list::part(list) {
      gap: 0;
    }
  `;

  constructor() {
    super();
    this.parentWindow = window.docShell.chromeEventHandler.ownerGlobal;
    this.gBrowser = this.parentWindow.gBrowser;
    this.tabs = this.gBrowser.tabs;

    const tabContainer = this.gBrowser.tabContainer;
    tabContainer.addEventListener("TabSelect", this);
    tabContainer.addEventListener("TabAttrModified", this);
    tabContainer.addEventListener("TabClose", this);
    tabContainer.addEventListener("TabMove", this);
    tabContainer.addEventListener("TabOpen", this);
    tabContainer.addEventListener("TabPinned", this);
    tabContainer.addEventListener("TabUnpinned", this);
  }

  onCloseTab(e) {
    this.gBrowser.removeTab(e.detail.item.tabElement);
  }

  onSelectTab(e) {
    this.gBrowser.selectedTab = e.detail.item.tabElement;
  }

  handleEvent(e) {
    if (e.type.startsWith("Tab")) {
      this.tabs = this.gBrowser.tabs;
      this.requestUpdate();
    }
  }

  render() {
    return html`<fxview-tab-list
      .maxTabsLength=${-1}
      .tabItems=${getTabListItems(this.tabs)}
      compactrows
      showselected
      @fxview-tab-list-primary-action=${this.onSelectTab}
      @fxview-tab-list-secondary-action=${this.onCloseTab}
    ></fxview-tab-list>`;
  }
}
customElements.define("home-sidebar", HomeSidebar);
