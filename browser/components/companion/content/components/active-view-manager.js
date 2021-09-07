/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const { PanelMultiView } = ChromeUtils.import(
  "resource:///modules/PanelMultiView.jsm"
);

class ActiveViewManager extends HTMLElement {
  /** @type {<html:button>} */
  #overflow;
  /** @type {<xul:panel>} */
  #overflowPanel;
  /** @type {<xul:panel>} */
  #pageActionPanel;

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
    this.#river.addEventListener("RiverRegrouped", this);
    this.#overflow.addEventListener("click", this);
  }

  disconnectedCallback() {
    for (let event of ActiveViewManager.EVENTS) {
      window.top.gGlobalHistory.removeEventListener(event, this);
    }
    this.removeEventListener("UserAction:ViewSelected", this);
    this.removeEventListener("UserAction:OpenPageActionMenu", this);
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

    if (this.isRiverView(view)) {
      this.#river.activeView = view;
    } else {
      console.warn("Saw ViewChanged for an unknown view.");
    }
  }

  viewMoved(view) {
    // TODO: Show a moving animation.
    this.#river.addView(view);
    this.#river.activeView = view;
  }

  viewUpdated(view) {
    if (this.isRiverView(view)) {
      this.#river.requestUpdate();
    } else {
      console.warn("Saw ViewUpdated for an unknown view.");
    }
  }

  rebuild() {
    this.#river.setViews(window.top.gGlobalHistory.views);
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
        // TODO: Support users removing specific views like closing a tab.

        // I'm assuming here that we'd never want to remove a view from GlobalHistory unless it
        // is in the river or the overflow menu i.e. we don't ever want to remove a view that is
        // user's the top view.
        this.#river.removeView(event.view);
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
      case "click":
        if (event.target == this.#overflow) {
          this.#openOverflowPanel(event);
        } else if (event.currentTarget == this.#overflowPanel) {
          this.#overflowPanelClicked(event);
        } else if (event.currentTarget == this.#pageActionPanel) {
          this.#pageActionPanelClicked(event);
        }
        break;
      case "keypress": {
        if (event.currentTarget == this.#pageActionPanel) {
          this.#pageActionPanelKeypress(event);
        }
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
        this.#overflow.textContent = `+${event.detail.overflowCount}`;
        this.#overflow.hidden = event.detail.overflowCount == 0;
        break;
      }
      case "TopViewOverflow": {
        this.#river.addViews(event.detail.views);
        break;
      }
      case "ViewPinned": {
        let view = event.view;
        if (this.isRiverView(view)) {
          this.#river.removeView(view);
        }
        this.#pinnedViews.addView(view);
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
        panel.addEventListener("keypress", this);
      }

      this.#pageActionPanel = panel;
    }
    return this.#pageActionPanel;
  }

  #pageActionPanelHiding(event) {
    this.#pageActionView = null;
  }

  #pageActionPanelShowing(event) {
    let pageActionTitleEl = document.getElementById("site-info-title");
    pageActionTitleEl.value = this.#pageActionView.title;
    pageActionTitleEl.scrollLeft = 0;

    let pageActionUrlEl = document.getElementById("site-info-url");
    pageActionUrlEl.textContent = this.#pageActionView.url.spec;
  }

  #pageActionPanelClicked(event) {
    let titleEl = document.getElementById("site-info-title");
    let editImg = document.getElementById("site-info-edit-icon");
    let pinView = document.getElementById("pin-view");

    if (event.target == editImg) {
      titleEl.focus();
    } else if (pinView.contains(event.target)) {
      window.top.gGlobalHistory.setViewPinnedState(
        this.#pageActionView,
        !this.#pageActionView.pinned
      );
      this.#pageActionPanel.hidePopup();
    } else if (event.target != titleEl) {
      this.#pageActionPanel.hidePopup();
    }
  }

  #pageActionPanelKeypress(event) {
    let siteInfoTitleEl = document.getElementById("site-info-title");
    if (
      event.target == siteInfoTitleEl &&
      event.keyCode == KeyEvent.DOM_VK_RETURN
    ) {
      let userTitle = siteInfoTitleEl.value;
      if (userTitle) {
        this.#pageActionView.userTitle = userTitle;
        this.viewUpdated(this.#pageActionView);
      }
      this.#pageActionPanel.hidePopup();
    }
  }
}
customElements.define("active-view-manager", ActiveViewManager);
