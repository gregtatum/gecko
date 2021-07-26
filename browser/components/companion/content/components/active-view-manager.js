/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class ActiveViewManager extends HTMLElement {
  /** @type {<html:button>} */
  #overflow;
  /** @type {<xul:panel>} */
  #overflowPanel;
  #river;
  #topView;

  static EVENTS = [
    "ViewChanged",
    "ViewAdded",
    "ViewRemoved",
    "ViewMoved",
    "ViewUpdated",
  ];

  connectedCallback() {
    let template = document.getElementById("template-active-view-manager");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);

    this.#overflow = this.querySelector("#river-overflow-button");
    this.#river = this.querySelector("river-el");
    this.#topView = this.querySelector("top-view");

    for (let event of ActiveViewManager.EVENTS) {
      window.top.gGlobalHistory.addEventListener(event, this);
    }

    this.addEventListener("UserAction:ViewSelected", this);
    this.#river.addEventListener("RiverRegrouped", this);
    this.#topView.addEventListener("TopViewOverflow", this);
    this.#overflow.addEventListener("click", this);
  }

  disconnectedCallback() {
    for (let event of ActiveViewManager.EVENTS) {
      window.top.gGlobalHistory.removeEventListener(event, this);
    }
    this.removeEventListener("UserAction:ViewSelected", this);
    this.#river.removeEventListener("RiverRegrouped", this);
    this.#topView.removeEventListener("TopViewOverflow", this);
    this.#overflow.removeEventListener("click", this);
  }

  isTopView(view) {
    return this.#topView.hasView(view);
  }

  isRiverView(view) {
    return this.#river.hasView(view);
  }

  viewChanged(view) {
    this.#river.activeView = null;
    this.#topView.activeView = null;

    if (this.isTopView(view)) {
      this.#topView.activeView = view;
    } else if (this.isRiverView(view)) {
      this.#river.activeView = view;
    } else {
      console.warn("Saw ViewChanged for an unknown view.");
    }
  }

  viewMoved(view) {
    // TODO: Show a moving animation.

    // Nothing to do if "ViewMoved" was dispatched for a view that's already the top view.
    if (this.isRiverView(view)) {
      this.#river.activeView = null;
      this.#river.removeView(view);
    }
    this.#topView.addView(view);
  }

  viewUpdated(view) {
    if (this.isTopView(view)) {
      this.#topView.viewUpdated();
    } else if (this.isRiverView(view)) {
      this.#river.requestUpdate();
    } else {
      console.warn("Saw ViewUpdated for an unknown view.");
    }
  }

  handleEvent(event) {
    switch (event.type) {
      case "ViewAdded":
        this.#topView.addView(event.view);
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
      case "UserAction:ViewSelected":
        let view = event.detail.clickedView;
        this.#viewSelected(view);
        break;
      case "click":
        if (event.target == this.#overflow) {
          this.#overflowClicked(event);
        } else if (event.currentTarget == this.#overflowPanel) {
          this.#overflowPanelClicked(event);
        }
        break;
      case "popupshowing":
        if (event.currentTarget == this.#overflowPanel) {
          this.#overflowPanelShowing(event);
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
    }
  }

  #viewSelected(view) {
    this.#river.activeView = null;
    this.#topView.activeView = null;

    if (this.isRiverView(view)) {
      this.#river.activeView = view;
    } else if (this.isTopView(view)) {
      this.#topView.activeView = view;
    }
    window.top.gGlobalHistory.setView(view);
  }

  #overflowClicked(event) {
    if (!this.#overflowPanel) {
      this.#overflowPanel = this.#getOrCreateOverflowPanel();
    }

    this.#overflowPanel.openPopup(this.#overflow, {
      position: "bottomcenter topleft",
      triggerEvent: event,
    });
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

  #getOrCreateOverflowPanel() {
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

    return panel;
  }
}
customElements.define("active-view-manager", ActiveViewManager);
