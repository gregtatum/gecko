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
const WORKSPACE_COUNTER_OFFSET = 1;

export default class ActiveViewManager extends window.MozHTMLElement {
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

  #pageActionView;
  #contextMenuViewGroup;
  #contextMenuView;

  static EVENTS = [
    "WorkspaceAdded",
    "ViewChanged",
    "ViewAdded",
    "ViewRemoved",
    "ViewMoved",
    "ViewUpdated",
  ];

  connectedCallback() {
    if (this.delayConnectedCallback()) {
      return;
    }

    let template = document.getElementById("template-active-view-manager");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);

    this.#contextMenuPopup = document.getElementById(
      "active-view-manager-context-menu"
    );

    for (let event of ActiveViewManager.EVENTS) {
      window.gStageManager.addEventListener(event, this);
    }

    this.addEventListener("UserAction:OpenOverflowPanel", this);
    this.addEventListener("UserAction:ViewSelected", this);
    this.addEventListener("UserAction:ViewGroupSelected", this);
    this.addEventListener("UserAction:ViewGroupCloseOne", this);
    this.addEventListener("UserAction:OpenPageActionMenu", this);
    this.addEventListener("UserAction:PinView", this);
    this.addEventListener("UserAction:UnpinView", this);

    this.addEventListener("click", this);
    this.addEventListener("contextmenu", this);
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
      window.gStageManager.removeEventListener(event, this);
    }
    this.removeEventListener("UserAction:OpenOverflowPanel", this);
    this.removeEventListener("UserAction:ViewSelected", this);
    this.removeEventListener("UserAction:ViewGroupCloseOne", this);
    this.removeEventListener("UserAction:OpenPageActionMenu", this);
    this.removeEventListener("UserAction:PinView", this);
    this.removeEventListener("UserAction:UnpinView", this);

    this.removeEventListener("click", this);
    this.removeEventListener("contextmenu", this);
  }

  handleEvent(event) {
    switch (event.type) {
      case "WorkspaceAdded": {
        let id = event.detail.workspaceId;
        this.#createWorkspaceElement(id);
        this.#manageWorkspaceIndicatorButtons();

        let urlbar = document.getElementById("urlbar");
        urlbar.setAttribute("workspace-id", id);

        // Update state in other previously opened workspaces.
        this.#updateWorkspaces(id);
        break;
      }
      case "ViewAdded":
      // Intentional fall-through
      case "ViewChanged":
      // Intentional fall-through
      case "ViewMoved":
      // Intentional fall-through
      case "ViewRemoved":
      // Intentional fall-through
      case "ViewUpdated": {
        let workspaceId = event.view.workspaceId;
        let workspace = window.gStageManager.getWorkspaceWithId(workspaceId);
        let workspaceEl = this.querySelector(
          "[workspace-id='" + workspaceId + "']"
        );
        workspaceEl.update(
          workspace?.viewGroups,
          workspace?.overflowedViews,
          workspace?.pinnedViewGroups
        );
        workspaceEl.classList.toggle(
          "contains-pins",
          workspace?.pinnedViewGroups.length
        );
        this.#updateWorkspaces(workspaceId);
        break;
      }
      case "UserAction:ViewSelected": {
        let view = event.detail.clickedView;
        this.#viewSelected(view);
        break;
      }
      case "UserAction:ViewGroupSelected": {
        let viewGroup = event.detail.clickedViewGroup;
        this.#viewGroupSelected(viewGroup);
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
        this.#setViewPinnedState(view, true, { index });
        break;
      }
      case "UserAction:UnpinView": {
        let view = event.detail.view;
        this.#setViewPinnedState(view, false);
        break;
      }
      case "UserAction:ViewGroupCloseOne": {
        let viewGroup = event.detail.clickedViewGroup;
        this.#viewGroupCloseOne(viewGroup);
        break;
      }
      case "UserAction:OpenOverflowPanel":
        this.#openOverflowPanel(event);
        break;
      case "command":
        if (event.currentTarget == this.#overflowPanel) {
          this.#overflowPanelItemSelected(event);
        } else if (event.currentTarget == this.#pageActionPanel) {
          this.#pageActionItemSelected(event);
        }
        break;
      case "contextmenu": {
        this.#onContextMenu(event);
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
    }
  }

  #updateWorkspaces(activeWorkspaceId) {
    let workspaceEl = this.querySelector(
      "[workspace-id='" + activeWorkspaceId + "']"
    );
    let allWorkspaces = this.querySelectorAll("workspace-el");
    allWorkspaces.forEach(w => {
      w.setActiveView(window.gStageManager.currentView);
      w.classList.toggle("selected", w == workspaceEl);
    });
  }

  #createWorkspaceElement(id) {
    let workspace = this.querySelector("[workspace-id='" + id + "']");
    if (workspace) {
      console.warn("Saw WorkspaceAdded for a workspace that already exists.");
      return;
    }

    workspace = document.createElement("workspace-el");
    workspace.setAttribute("workspace-id", id);
    this.appendChild(workspace);
  }

  #manageWorkspaceIndicatorButtons() {
    let workspaces = this.querySelectorAll("workspace-el");
    workspaces.forEach(workspace => {
      let id = workspace.getAttribute("workspace-id");
      let button = workspace.querySelector(".workspace-indicator-button");
      button.textContent = parseInt(id) + WORKSPACE_COUNTER_OFFSET;
      button.hidden = false;
      workspace.classList.add("multiple");
    });
  }

  #viewSelected(view) {
    window.gStageManager.setView(view);
  }

  #viewGroupSelected(viewGroup) {
    window.gStageManager.setViewInGroup(viewGroup);
  }

  #viewGroupCloseOne(viewGroup) {
    window.gStageManager.closeViewInGroup(viewGroup);
  }

  /**
   * Overflow panel creation and handling
   */

  #openOverflowPanel(event) {
    let panel = this.#getOverflowPanel();
    let workspaceId = event.target.parentNode.parentNode.getAttribute(
      "workspace-id"
    );
    panel.setAttribute("workspace-id", workspaceId);
    PanelMultiView.openPopup(
      panel,
      event.composedTarget,
      "topleft bottomleft"
    ).catch(Cu.reportError);
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
        panel.addEventListener("command", this);
      }
      this.#overflowPanel = panel;
    }

    return this.#overflowPanel;
  }

  #overflowPanelItemSelected(event) {
    if (event.target.tagName != "toolbarbutton") {
      return;
    }

    let view = event.target.view;
    this.#viewSelected(view);
    this.#overflowPanel.removeAttribute("workspace-id");
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
    let workspaceId = this.#overflowPanel.getAttribute("workspace-id");
    let workspace = this.querySelector("[workspace-id='" + workspaceId + "']");
    let overflowedViews = workspace.overflowedViews;

    for (let view of overflowedViews) {
      let item = document.createXULElement("toolbarbutton");
      item.classList.add("subviewbutton", "subviewbutton-iconic");
      item.setAttribute("tabindex", "0");
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
        panel.addEventListener("command", this);
        panel.addEventListener("keydown", this);
      }

      this.#pageActionPanel = panel;
    }
    return this.#pageActionPanel;
  }

  #pageActionPanelHiding(event) {
    CustomizableUI.removePanelCloseListeners(this.#pageActionPanel);

    // Restart view activation timer once PAM is closed.
    window.gStageManager.startActivationTimer();

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
    window.gStageManager.clearActivationTimer();

    let view = this.#pageActionView;
    let pinView = document.getElementById("page-action-pin-view");
    let pinViewL10nId = view.pinned
      ? "page-action-toggle-pinning-view-pinned"
      : "page-action-toggle-pinning-view-unpinned";
    document.l10n.setAttributes(pinView, pinViewL10nId);

    let pinApp = document.getElementById("page-action-pin-app");
    let pinAppL10nId = view.pinned
      ? "page-action-toggle-pinning-app-pinned"
      : "page-action-toggle-pinning-app-unpinned";
    document.l10n.setAttributes(pinApp, pinAppL10nId);

    let muteView = document.getElementById("page-action-mute");
    let muteViewL10nId = view.muted
      ? "page-action-toggle-muting-muted"
      : "page-action-toggle-muting-unmuted";
    document.l10n.setAttributes(muteView, muteViewL10nId);
    muteView.toggleAttribute("unmute", view.muted);

    if (view.isArticle) {
      let readerMode = document.getElementById("page-action-reader-mode");
      readerMode.hidden = false;
    }

    let pageActionTitleSection = document.getElementById(
      "site-info-title-section"
    );
    pageActionTitleSection.setAttribute("tooltiptext", view.title);
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

  #pageActionItemSelected(event) {
    let urlEl = document.getElementById("site-info-url");
    if (event.target != urlEl) {
      document.getSelection().removeAllRanges();
    }

    let titleEl = document.getElementById("site-info-title");
    let editImg = document.getElementById("site-info-edit-icon");
    if (event.target == editImg) {
      titleEl.focus();
    } else if (event.target != titleEl) {
      titleEl.blur();
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
    window.gStageManager.setUserTitle(this.#pageActionView, event.target.value);

    let pageActionTitleSection = document.getElementById(
      "site-info-title-section"
    );
    pageActionTitleSection.setAttribute("tooltiptext", event.target.value);
  }

  pageActionPinView(event) {
    this.#setViewPinnedState(
      this.#pageActionView,
      !this.#pageActionView.pinned
    );
  }

  pageActionPinApp(event) {
    this.#setViewPinnedState(
      this.#pageActionView,
      !this.#pageActionView.pinned,
      { appMode: true }
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

    this.#contextMenuViewGroup = viewGroup;
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

    let closeViewGroupMenuItem = document.getElementById(
      "active-view-manager-context-menu-close-view-group"
    );
    let closeViewGroupL10nId =
      "active-view-manager-context-menu-close-view-group";
    document.l10n.setAttributes(closeViewGroupMenuItem, closeViewGroupL10nId, {
      viewCount: this.#contextMenuViewGroup.viewGroup.length,
    });
  }

  #contextMenuPopupHiding(event) {
    this.#contextMenuViewGroup = null;
    this.#contextMenuView = null;
  }

  contextMenuPinView(event) {
    this.#setViewPinnedState(
      this.#contextMenuView,
      !this.#contextMenuView.pinned
    );
  }

  contextMenuCloseViewGroup(event) {
    let views = this.#contextMenuViewGroup.viewGroup;
    for (let view of views) {
      window.gStageManager.closeView(view);
    }
  }

  #getEventViewGroup(event) {
    let node = event.composedTarget;
    let host = node.getRootNode().host;
    if (host.localName == "view-group") {
      return host;
    }

    return null;
  }

  #setViewPinnedState(
    view,
    state,
    { index = undefined, appMode = false } = {}
  ) {
    window.gStageManager.setViewPinnedState(view, state, appMode, index);
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
