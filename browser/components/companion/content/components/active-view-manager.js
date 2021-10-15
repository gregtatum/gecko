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

  #river;
  #pinnedViews;
  #pageActionView;

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

    this.#overflow = this.querySelector("#river-overflow-button");
    this.#river = this.querySelector("river-el");
    this.#pinnedViews = this.querySelector("pinned-views");

    for (let event of ActiveViewManager.EVENTS) {
      window.top.gGlobalHistory.addEventListener(event, this);
    }

    this.addEventListener("UserAction:ViewSelected", this);
    this.addEventListener("UserAction:OpenPageActionMenu", this);
    this.addEventListener("UserAction:PinView", this);
    this.addEventListener("UserAction:UnpinView", this);

    this.addEventListener("dragstart", this);
    this.addEventListener("dragend", this);
    this.#river.addEventListener("RiverRegrouped", this);
    this.#overflow.addEventListener("click", this);

    // Most strings are borrowed from Firefox. We may need to need to replace these when UX
    // provides updated strings.
    this.#securityStringsMap = new Map([
      ["aboutUI", "identity-connection-internal"],
      ["localResource", "identity-connection-file"],
      ["verifiedDomain", "companion-page-action-secure-page"],
    ]);
  }

  disconnectedCallback() {
    for (let event of ActiveViewManager.EVENTS) {
      window.top.gGlobalHistory.removeEventListener(event, this);
    }
    this.removeEventListener("UserAction:ViewSelected", this);
    this.removeEventListener("UserAction:OpenPageActionMenu", this);
    this.removeEventListener("UserAction:PinView", this);
    this.removeEventListener("UserAction:UnpinView", this);

    this.removeEventListener("dragstart", this);
    this.removeEventListener("dragend", this);
    this.#river.removeEventListener("RiverRegrouped", this);
    this.#overflow.removeEventListener("click", this);
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
    this.#river.setViews(window.top.gGlobalHistory.views);
    this.#pinnedViews.clear();
    this.viewChanged(window.top.gGlobalHistory.currentView);
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
        }
        break;
      }
      case "popupshowing":
        if (event.currentTarget == this.#overflowPanel) {
          this.#overflowPanelShowing(event);
        } else if (event.currentTarget == this.#pageActionPanel) {
          this.#pageActionPanelShowing(event);
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
    window.top.gGlobalHistory.setView(view);
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
    PanelMultiView.openPopup(panel, target, {
      position: "bottomcenter topright",
    }).catch(Cu.reportError);
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

    let pageActionTitleEl = document.getElementById("site-info-title");
    pageActionTitleEl.value = view.title;
    pageActionTitleEl.scrollLeft = 0;

    let pageActionUrlEl = document.getElementById("site-info-url");
    pageActionUrlEl.textContent = view.url.spec;

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
    let titleEl = document.getElementById("site-info-title");
    let editImg = document.getElementById("site-info-edit-icon");

    if (event.target == editImg) {
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

  #onDragStart(event) {
    let draggedViewGroup = this.#getDragTargetViewGroup(event);
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
    dt.setDragImage(draggedViewGroup.iconContainer, 0, 0);
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

  #getDragTargetViewGroup(event) {
    let node = event.composedTarget;
    let host = node.getRootNode().host;
    if (host.localName == "view-group") {
      return host;
    }

    return null;
  }

  #setViewPinnedState(view, state, index) {
    window.top.gGlobalHistory.setViewPinnedState(view, state, index);
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
