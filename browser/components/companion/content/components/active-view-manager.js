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

export default class ActiveViewManager extends window.MozHTMLElement {
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
  /** @type {<xul:menupopup>} */
  #contextMenuPopup;
  /** @type {Workspace} */
  #defaultWorkspace;

  #pageActionView;
  #contextMenuView;

  static EVENTS = [
    "ViewChanged",
    "ViewAdded",
    "ViewRemoved",
    "ViewMoved",
    "ViewUpdated",
    "ViewPinned",
    "ViewUnpinned",
  ];

  connectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }

    let template = document.getElementById("template-active-view-manager");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);

    this.#defaultWorkspace = this.querySelector("workspace-el");
    this.#overflow = this.querySelector("#river-overflow-button");
    this.#contextMenuPopup = document.getElementById(
      "active-view-manager-context-menu"
    );

    for (let event of ActiveViewManager.EVENTS) {
      window.gGlobalHistory.addEventListener(event, this);
    }

    this.addEventListener("UserAction:ViewSelected", this);
    this.addEventListener("UserAction:OpenPageActionMenu", this);
    this.addEventListener("UserAction:PinView", this);
    this.addEventListener("UserAction:UnpinView", this);

    this.addEventListener("contextmenu", this);
    this.addEventListener("dragstart", this);
    this.addEventListener("dragend", this);
    this.#overflow.addEventListener("click", this);
    this.#contextMenuPopup.addEventListener("popupshowing", this);
    this.#contextMenuPopup.addEventListener("popuphiding", this);

    // Most strings are borrowed from Firefox. We may need to need to replace these when UX
    // provides updated strings.
    this.#securityStringsMap = new Map([
      ["aboutUI", "identity-connection-internal"],
      ["readerMode", "page-action-menu-reader-view"],
      ["localResource", "identity-connection-file"],
      ["verifiedDomain", "page-action-menu-secure-page"],
    ]);
  }

  disconnectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }

    for (let event of ActiveViewManager.EVENTS) {
      window.gGlobalHistory.removeEventListener(event, this);
    }
    this.removeEventListener("UserAction:ViewSelected", this);
    this.removeEventListener("UserAction:OpenPageActionMenu", this);
    this.removeEventListener("UserAction:PinView", this);
    this.removeEventListener("UserAction:UnpinView", this);

    this.removeEventListener("contextmenu", this);
    this.removeEventListener("dragstart", this);
    this.removeEventListener("dragend", this);
    this.#overflow.removeEventListener("click", this);
  }

  handleEvent(event) {
    switch (event.type) {
      case "ViewAdded":
        this.#defaultWorkspace.addView(event.view);
        break;
      case "ViewChanged":
        this.#defaultWorkspace.setActiveView(event.view);
        break;
      case "ViewMoved":
        this.#defaultWorkspace.moveView(event.view);
        break;
      case "ViewRemoved":
        this.#defaultWorkspace.removeView(event.view);
        break;
      case "ViewUpdated":
        this.#defaultWorkspace.updateView(event.view);
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
      case "keydown": {
        if (this.#pageActionPanel.contains(event.target)) {
          this.#pageActionPanelKeyDown(event);
        }
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
      case "ViewPinned": {
        let view = event.view;
        let index = event.detail.index;
        if (this.#defaultWorkspace.isRiverView(view)) {
          this.#defaultWorkspace.removeView(view);
        }
        this.#defaultWorkspace.addView(view, true, index);
        break;
      }
      case "ViewUnpinned": {
        let view = event.view;
        this.#defaultWorkspace.removeView(view);
        this.#defaultWorkspace.addView(event.view);
        break;
      }
    }
  }

  #viewSelected(view) {
    this.#defaultWorkspace.setActiveView(view);
    window.gGlobalHistory.setView(view);
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
    let overflowedViews = this.#defaultWorkspace.overflowedViews;

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
        panel.addEventListener("keydown", this);
      }

      this.#pageActionPanel = panel;
    }
    return this.#pageActionPanel;
  }

  #pageActionPanelHiding(event) {
    CustomizableUI.removePanelCloseListeners(this.#pageActionPanel);

    // Restart view activation timer once PAM is closed.
    window.gGlobalHistory.startActivationTimer();

    this.#pageActionView = null;
    let siteSecurityIcon = document.getElementById("site-security-icon");
    siteSecurityIcon.classList.remove(this.#securityIconClass);

    let pageActionUrlEl = document.getElementById("site-info-url");
    pageActionUrlEl.removeAttribute("title");

    let readerMode = document.getElementById("page-action-reader-mode");
    readerMode.hidden = true;
  }

  #pageActionPanelShowing(event) {
    CustomizableUI.addPanelCloseListeners(this.#pageActionPanel);

    // Clear activation timeout if the page action menu is open.
    window.gGlobalHistory.clearActivationTimer();

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
    }

    let pageActionTitleEl = document.getElementById("site-info-title");
    pageActionTitleEl.value = view.title;
    pageActionTitleEl.scrollLeft = 0;

    let pageActionUrlEl = document.getElementById("site-info-url");
    pageActionUrlEl.value = view.url.spec;
    pageActionUrlEl.scrollLeft = 0;

    // If url is overflowing the space available in PAM, we will prioritize
    // showing the full registrable domain first. If there's extra space, we
    // will prioritize showing the full hostname, scheme + hostname,
    // scheme + hostname + path i.e the complete URL, in that order.
    let baseDomain = Services.eTLD.getBaseDomain(view.url);
    let startIndex = view.url.spec.indexOf(baseDomain);

    // ELLIPSIS_SPILL_CHARS is how many additional characters we want to move a long
    // URL past the end of the base domain in order to make sure that the last part of the
    // base domain is not truncated by a text overflow ellipsis.
    const ELLIPSIS_SPILL_CHARS = 3;
    let endIndex = startIndex + baseDomain.length + ELLIPSIS_SPILL_CHARS;

    pageActionUrlEl.selectionStart = startIndex;
    pageActionUrlEl.selectionEnd = endIndex;
    let selectionController = window.docShell
      .QueryInterface(Ci.nsIInterfaceRequestor)
      .getInterface(Ci.nsISelectionDisplay)
      .QueryInterface(Ci.nsISelectionController);
    selectionController.scrollSelectionIntoView(
      Ci.nsISelectionController.SELECTION_NORMAL,
      Ci.nsISelectionController.SELECTION_FOCUS_REGION,
      true
    );

    let pageActionUrlSectionEl = document.getElementById(
      "site-info-url-section"
    );
    pageActionUrlSectionEl.setAttribute("tooltiptext", view.url.spec);

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

  #pageActionPanelKeyDown(event) {
    let urlEl = document.getElementById("site-info-url");
    if (event.target == urlEl && event.keyCode == KeyEvent.DOM_VK_RETURN) {
      let url = event.target.value;
      window.openTrustedLinkIn(url, "tab", {
        fromChrome: true,
        skipTabAnimation: true,
      });
    }
  }

  pageActionEditViewTitle(event) {
    window.gGlobalHistory.updateUserTitle(
      this.#pageActionView,
      event.target.value
    );
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

    this.#defaultWorkspace.dragging = true;

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

    this.#defaultWorkspace.dragging = false;
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
    window.gGlobalHistory.setViewPinnedState(view, state, index);
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
