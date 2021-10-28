/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.defineModuleGetter(
  globalThis,
  "PanelMultiView",
  "resource:///modules/PanelMultiView.jsm"
);
ChromeUtils.defineModuleGetter(
  globalThis,
  "CustomizableUI",
  "resource:///modules/CustomizableUI.jsm"
);

/* import-globals-from ../../../../base/content/browser-pinebuild.js */

import getSiteSecurityInfo from "../siteSecurity.js";

export default class ActiveViewManager extends HTMLElement {
  /** @type {<html:button>} */
  #overflow;
  /** @type {<xul:panel>} */
  #overflowPanel;
  /** @type {<xul:panel>} */
  #pageActionPanel;
  /** @type {Map<string, string>} */
  #securityStringsMap;
  /** @type {string} */
  #securityIconClass;
  /** @type {GlobalHistory} */
  #globalHistory;
  /** @type {<xul:menupopup>} */
  #contextMenuPopup;

  #river;
  #pinnedViews;
  #pageActionView;
  #contextMenuView;
  #initted = false;

  static EVENTS = [
    "ViewChanged",
    "ViewAdded",
    "ViewRemoved",
    "ViewMoved",
    "ViewUpdated",
    "RiverRebuilt",
    "ViewPinned",
    "ViewUnpinned",
  ];

  connectedCallback() {
    let template = document.getElementById("template-active-view-manager");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);
  }

  init(globalHistory) {
    if (this.#initted) {
      throw new Error("ActiveViewManager already initted.");
    }

    this.#globalHistory = globalHistory;

    this.#overflow = this.querySelector("#river-overflow-button");
    this.#river = this.querySelector("river-el");
    this.#pinnedViews = this.querySelector("pinned-views");
    this.#contextMenuPopup = document.getElementById(
      "active-view-manager-context-menu"
    );

    for (let event of ActiveViewManager.EVENTS) {
      this.#globalHistory.addEventListener(event, this);
    }

    this.addEventListener("UserAction:ViewSelected", this);
    this.addEventListener("UserAction:OpenPageActionMenu", this);
    this.addEventListener("UserAction:PinView", this);
    this.addEventListener("UserAction:UnpinView", this);

    this.addEventListener("contextmenu", this);
    this.addEventListener("dragstart", this);
    this.addEventListener("dragend", this);
    this.#river.addEventListener("RiverRegrouped", this);
    this.#overflow.addEventListener("click", this);
    this.#contextMenuPopup.addEventListener("popupshowing", this);
    this.#contextMenuPopup.addEventListener("popuphiding", this);

    // Most strings are borrowed from Firefox. We may need to need to replace these when UX
    // provides updated strings.
    this.#securityStringsMap = new Map([
      ["aboutUI", "identity-connection-internal"],
      ["readerMode", "page-action-menu-reader-mode"],
      ["localResource", "identity-connection-file"],
      ["verifiedDomain", "page-action-menu-secure-page"],
    ]);

    this.#initted = true;
  }

  disconnectedCallback() {
    for (let event of ActiveViewManager.EVENTS) {
      this.#globalHistory.removeEventListener(event, this);
    }
    this.removeEventListener("UserAction:ViewSelected", this);
    this.removeEventListener("UserAction:OpenPageActionMenu", this);
    this.removeEventListener("UserAction:PinView", this);
    this.removeEventListener("UserAction:UnpinView", this);

    this.removeEventListener("contextmenu", this);
    this.removeEventListener("dragstart", this);
    this.removeEventListener("dragend", this);
    this.#river.removeEventListener("RiverRegrouped", this);
    this.#overflow.removeEventListener("click", this);
    this.#globalHistory = null;
    this.#initted = false;
  }

  isRiverView(view) {
    return this.#river.hasView(view);
  }

  isPinnedView(view) {
    return this.#pinnedViews.hasView(view);
  }

  viewChanged(view) {
    this.#river.activeView = null;
    this.#pinnedViews.activeView = null;

    if (this.isRiverView(view)) {
      this.#river.activeView = view;
    } else if (this.isPinnedView(view)) {
      this.#pinnedViews.activeView = view;
    } else {
      console.warn("Saw ViewChanged for an unknown view.");
    }
  }

  viewMoved(view) {
    // TODO: Show a moving animation.
    this.#river.addView(view);
    this.#river.activeView = view;
  }

  viewRemoved(view) {
    if (this.isRiverView(view)) {
      this.#river.removeView(view);
    } else if (this.isPinnedView(view)) {
      this.#pinnedViews.removeView(view);
    } else {
      console.warn("Saw ViewRemoved for an unknown view.");
    }
  }

  viewUpdated(view) {
    if (this.isRiverView(view)) {
      this.#river.viewUpdated();
    } else {
      console.warn("Saw ViewUpdated for an unknown view.");
    }
  }

  rebuild() {
    this.#river.setViews(this.#globalHistory.views);
    this.#pinnedViews.clear();
    this.viewChanged(this.#globalHistory.currentView);
  }

  handleEvent(event) {
    switch (event.type) {
      case "ViewAdded":
        this.#river.addView(event.view);
        break;
      case "ViewChanged":
        this.viewChanged(event.view);
        break;
      case "ViewMoved":
        this.viewMoved(event.view);
        break;
      case "ViewRemoved":
        this.viewRemoved(event.view);
        break;
      case "ViewUpdated":
        this.viewUpdated(event.view);
        break;
      case "RiverRebuilt":
        this.rebuild();
        break;
      case "UserAction:ViewSelected": {
        let view = event.detail.clickedView;
        this.#viewSelected(view);
        break;
      }
      case "UserAction:OpenPageActionMenu": {
        let view = event.detail.view;
        this.#openPageActionPanel(event.composedTarget, view);
        break;
      }
      case "UserAction:PinView": {
        let view = event.detail.view;
        let index = event.detail.index;
        this.#setViewPinnedState(view, true, index);
        break;
      }
      case "UserAction:UnpinView": {
        let view = event.detail.view;
        this.#setViewPinnedState(view, false);
        break;
      }
      case "click":
        if (event.target == this.#overflow) {
          this.#openOverflowPanel(event);
        } else if (event.currentTarget == this.#overflowPanel) {
          this.#overflowPanelClicked(event);
        } else if (event.currentTarget == this.#pageActionPanel) {
          this.#pageActionPanelClicked(event);
        }
        break;
      case "contextmenu": {
        this.#onContextMenu(event);
        break;
      }
      case "dragstart": {
        this.#onDragStart(event);
        break;
      }
      case "dragend": {
        this.#onDragEnd(event);
        break;
      }
      case "popuphiding": {
        if (event.currentTarget == this.#pageActionPanel) {
          this.#pageActionPanelHiding(event);
        } else if (event.currentTarget == this.#contextMenuPopup) {
          this.#contextMenuPopupHiding(event);
        }
        break;
      }
      case "popupshowing":
        if (event.currentTarget == this.#overflowPanel) {
          this.#overflowPanelShowing(event);
        } else if (event.currentTarget == this.#pageActionPanel) {
          this.#pageActionPanelShowing(event);
        } else if (event.currentTarget == this.#contextMenuPopup) {
          this.#contextMenuPopupShowing(event);
        }
        break;
      case "RiverRegrouped": {
        let l10nId = this.#overflow.getAttribute("data-l10n-id");
        let count = event.detail.overflowCount;
        document.l10n.setAttributes(this.#overflow, l10nId, { count });
        this.#overflow.hidden = count == 0;
        break;
      }
      case "TopViewOverflow": {
        this.#river.addViews(event.detail.views);
        break;
      }
      case "ViewPinned": {
        let view = event.view;
        let index = event.detail.index;
        if (this.isRiverView(view)) {
          this.#river.removeView(view);
        }
        this.#pinnedViews.addView(view, index);
        break;
      }
      case "ViewUnpinned": {
        let view = event.view;
        this.#pinnedViews.removeView(view);
        this.#river.addView(event.view);
        break;
      }
    }
  }

  #viewSelected(view) {
    this.#river.activeView = null;
    this.#pinnedViews.activeView = null;

    if (this.isRiverView(view)) {
      this.#river.activeView = view;
    } else if (this.isPinnedView(view)) {
      this.#pinnedViews.activeView = view;
    }
    this.#globalHistory.setView(view);
  }

  /**
   * Overflow panel creation and handling
   */

  #openOverflowPanel(event) {
    let panel = this.#getOverflowPanel();
    panel.openPopup(this.#overflow, {
      position: "bottomcenter topleft",
      triggerEvent: event,
    });
  }

  #getOverflowPanel() {
    if (!this.#overflowPanel) {
      let panel = document.getElementById("active-view-manager-overflow-panel");
      if (!panel) {
        let template = document.getElementById(
          "active-view-manager-overflow-panel-template"
        );
        template.replaceWith(template.content);
        panel = document.getElementById("active-view-manager-overflow-panel");
        panel.addEventListener("popupshowing", this);
        panel.addEventListener("click", this);
      }
      this.#overflowPanel = panel;
    }

    return this.#overflowPanel;
  }

  #overflowPanelClicked(event) {
    if (event.target.tagName != "toolbarbutton") {
      return;
    }

    let view = event.target.view;
    this.#viewSelected(view);
    this.#overflowPanel.hidePopup();
  }

  #overflowPanelShowing(event) {
    let list = this.#overflowPanel.querySelector(
      "#active-view-manager-overflow-list"
    );

    while (list.lastChild) {
      list.lastChild.remove();
    }

    let fragment = document.createDocumentFragment();
    let overflowedViews = this.#river.overflowedViews;

    for (let view of overflowedViews) {
      let item = document.createXULElement("toolbarbutton");
      item.classList.add("subviewbutton", "subviewbutton-iconic");
      item.setAttribute("label", view.title);
      item.setAttribute("image", `page-icon:${view.url.spec}`);
      item.view = view;
      fragment.appendChild(item);
    }

    list.appendChild(fragment);
  }

  /**
   * Page Action panel creation and handling
   */

  #openPageActionPanel(target, view) {
    this.#pageActionView = view;
    let panel = this.#getPageActionPanel();
    PanelMultiView.openPopup(panel, target, "after_end").catch(Cu.reportError);
  }

  #getPageActionPanel() {
    if (!this.#pageActionPanel) {
      let panel = document.getElementById("page-action-panel");
      if (!panel) {
        let template = document.getElementById("template-page-action-menu");
        template.replaceWith(template.content);
        panel = document.getElementById("page-action-panel");
        panel.addEventListener("popupshowing", this);
        panel.addEventListener("popuphiding", this);
        panel.addEventListener("click", this);
      }

      this.#pageActionPanel = panel;
    }
    return this.#pageActionPanel;
  }

  #pageActionPanelHiding(event) {
    CustomizableUI.removePanelCloseListeners(this.#pageActionPanel);
    this.#pageActionView = null;
    let siteSecurityIcon = document.getElementById("site-security-icon");
    siteSecurityIcon.classList.remove(this.#securityIconClass);

    let pageActionUrlEl = document.getElementById("site-info-url");
    pageActionUrlEl.removeAttribute("title");

    let readerMode = document.getElementById("page-action-reader-mode");
    readerMode.hidden = true;
    let pageActionsPanel = document.getElementById("page-action-panel");
    pageActionsPanel.classList.remove("reader-mode-available");
  }

  #pageActionPanelShowing(event) {
    CustomizableUI.addPanelCloseListeners(this.#pageActionPanel);
    let view = this.#pageActionView;

    let pinView = document.getElementById("page-action-pin-view");
    let pinL10nId = "page-action-toggle-pinning";
    document.l10n.setAttributes(pinView, pinL10nId, { isPinned: view.pinned });

    let muteView = document.getElementById("page-action-mute");
    document.l10n.setAttributes(muteView, "page-action-toggle-muting", {
      isMuted: view.muted,
    });
    muteView.toggleAttribute("unmute", view.muted);

    if (view.isArticle) {
      let readerMode = document.getElementById("page-action-reader-mode");
      readerMode.hidden = false;
      let pageActionPanel = document.getElementById("page-action-panel");
      pageActionPanel.classList.add("reader-mode-available");
    }

    let pageActionTitleEl = document.getElementById("site-info-title");
    pageActionTitleEl.value = view.title;
    pageActionTitleEl.scrollLeft = 0;

    let pageActionUrlEl = document.getElementById("site-info-url");
    pageActionUrlEl.textContent = view.url.spec;
    pageActionUrlEl.setAttribute("tooltiptext", view.url.spec);
    pageActionUrlEl.scrollLeft = 0;

    this.#securityIconClass = getSiteSecurityInfo(view);
    let siteSecurityIcon = document.getElementById("site-security-icon");
    siteSecurityIcon.classList.add(this.#securityIconClass);

    let siteSecurityInfo = document.getElementById("site-security-info");
    if (this.#securityStringsMap.has(this.#securityIconClass)) {
      let l10nID = this.#securityStringsMap.get(this.#securityIconClass);
      siteSecurityInfo.setAttribute("data-l10n-id", l10nID);
    } else {
      // TODO: If the page is a net error page, show "Connection failure" instead.
      siteSecurityInfo.setAttribute(
        "data-l10n-id",
        "identity-connection-not-secure"
      );
    }
  }

  #pageActionPanelClicked(event) {
    let urlEl = document.getElementById("site-info-url");
    if (event.target != urlEl) {
      document.getSelection().removeAllRanges();
    }

    let editImg = document.getElementById("site-info-edit-icon");
    if (event.target == editImg) {
      let titleEl = document.getElementById("site-info-title");
      titleEl.focus();
    }
  }

  pageActionEditViewTitle(event) {
    this.#pageActionView.userTitle = event.target.value;
    this.viewUpdated(this.#pageActionView);
  }

  pageActionPinView(event) {
    this.#setViewPinnedState(
      this.#pageActionView,
      !this.#pageActionView.pinned
    );
  }

  pageActionCopyURL(event) {
    PineBuildUIUtils.copy(this, this.#pageActionView.url.spec);
  }

  #onContextMenu(event) {
    let viewGroup = this.#getEventViewGroup(event);
    if (!viewGroup) {
      return;
    }

    // It's possible to open the context menu on a ViewGroup that is not
    // active, so in that case, we'll just assume we're opening the menu
    // on the last View in the group.
    this.#contextMenuView = viewGroup.active
      ? viewGroup.activeView
      : viewGroup.lastView;

    this.#contextMenuPopup.openPopupAtScreen(
      event.screenX,
      event.screenY,
      true,
      event
    );
    event.stopPropagation();
    event.preventDefault();
  }

  #contextMenuPopupShowing(event) {
    let pinViewMenuItem = document.getElementById(
      "active-view-manager-context-menu-toggle-pinning"
    );
    let pinL10nId = "active-view-manager-context-menu-toggle-pinning";
    document.l10n.setAttributes(pinViewMenuItem, pinL10nId, {
      isPinned: this.#contextMenuView.pinned,
    });
  }

  #contextMenuPopupHiding(event) {
    this.#contextMenuView = null;
  }

  contextMenuPinView(event) {
    this.#setViewPinnedState(
      this.#contextMenuView,
      !this.#contextMenuView.pinned
    );
  }

  #onDragStart(event) {
    let draggedViewGroup = this.#getEventViewGroup(event);
    if (!draggedViewGroup) {
      return;
    }

    // Hack needed so that the dragimage will still show the
    // item as it appeared before it was hidden.
    window
      .promiseDocumentFlushed(() => {})
      .then(() => {
        draggedViewGroup.setAttribute("dragging", "true");
      });

    this.#pinnedViews.dragging = true;

    let dt = event.dataTransfer;

    // Because we're relying on Lit to manipulate the DOM, we can
    // run into situations where the dragend event fails to fire if
    // the dragged ViewGroup element has been detached from the DOM,
    // which seems to occur sometimes when Lit decides that a pre-exiting
    // ViewGroup can be repurposed rather than being replaced with the
    // dragged ViewGroup.
    //
    // To work around this, we use the addElement API to make sure that
    // the dragend event fires on ActiveViewManager.
    dt.addElement(this);

    dt.mozSetDataAt(ActiveViewManager.VIEWGROUP_DROP_TYPE, draggedViewGroup, 0);

    let iconBounds = window.windowUtils.getBoundsWithoutFlushing(
      draggedViewGroup.iconContainer
    );
    dt.setDragImage(
      draggedViewGroup.iconContainer,
      iconBounds.width / 2,
      iconBounds.height / 2
    );
  }

  #onDragEnd(event) {
    let dt = event.dataTransfer;
    let draggedViewGroup = dt.mozGetDataAt(
      ActiveViewManager.VIEWGROUP_DROP_TYPE,
      0
    );
    draggedViewGroup.removeAttribute("dragging");

    this.#pinnedViews.dragging = false;
  }

  #getEventViewGroup(event) {
    let node = event.composedTarget;
    let host = node.getRootNode().host;
    if (host.localName == "view-group") {
      return host;
    }

    return null;
  }

  #setViewPinnedState(view, state, index) {
    this.#globalHistory.setViewPinnedState(view, state, index);
    this.#viewSelected(view);
  }

  /**
   * Returns an Object that exposes various private methods or
   * properties to help with automated testing. Returns null if
   * browser.pinebuild.active-view-manager.testing.enabled is not
   * set to true.
   */
  getTestingAPI() {
    if (
      !Services.prefs.getBoolPref(
        "browser.pinebuild.active-view-manager.testing.enabled",
        false
      )
    ) {
      return null;
    }

    return {
      getPageActionPanel: () => this.#getPageActionPanel(),
    };
  }

  static get VIEWGROUP_DROP_TYPE() {
    return "application/x-moz-pinebuild-viewgroup";
  }
}
customElements.define("active-view-manager", ActiveViewManager);
