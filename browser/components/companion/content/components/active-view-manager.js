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

    this.#overflow = this.querySelector("#overflow");
    this.#river = this.querySelector("river-el");
    this.#topView = this.querySelector("top-view");

    for (let event of ActiveViewManager.EVENTS) {
      window.top.gGlobalHistory.addEventListener(event, this);
    }

    this.addEventListener("UserAction:ViewSelected", this);
    this.#overflow.addEventListener("click", this);
  }

  disconnectedCallback() {
    for (let event of ActiveViewManager.EVENTS) {
      window.top.gGlobalHistory.removeEventListener(event, this);
    }
    this.removeEventListener("UserAction:ViewSelected", this);
    this.#overflow.removeEventListener("click", this);
  }

  isTopView(view) {
    return this.#topView.view == view;
  }

  isRiverView(view) {
    return this.#river.views.has(view);
  }

  viewChanged(view) {
    if (this.isTopView(view)) {
      // Close any active views in the river.
      this.#river.activatedView = null;
    } else if (this.isRiverView(view)) {
      this.#river.activatedView = view;
    } else {
      console.warn("Saw ViewChanged for an unknown view.");
    }
  }

  viewMoved(view) {
    // TODO: Show a moving animation.

    // Nothing to do if "ViewMoved" was dispatched for a view that's already the top view.
    if (this.isRiverView(view)) {
      // Moved existing top view into the river.
      let oldView = this.#topView.update(view);
      this.#river.addView(oldView);
      this.#river.activatedView = null;
      this.#river.removeView(view);
    } else if (!this.isTopView(view)) {
      console.warn("Saw ViewMoved for an unknown view.");
    }
  }

  viewUpdated(view) {
    if (this.isTopView(view)) {
      this.#topView.update(view);
    } else if (this.isRiverView(view)) {
      let viewEl = this.#river.views.get(view);
      viewEl.update(view);
    } else {
      console.warn("Saw ViewUpdated for an unknown view.");
    }
  }

  handleEvent(event) {
    switch (event.type) {
      case "ViewAdded":
        let oldView = this.#topView.update(event.view);
        this.#river.addView(oldView);
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
    }
  }

  #viewSelected(view) {
    if (this.isRiverView(view)) {
      this.#river.activatedView = view;
    } else if (this.isTopView(view)) {
      this.#river.activatedView = null;
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
    let overflownViewEls = Array.from(
      this.#river.querySelectorAll("view-el:nth-last-of-type(n + 6)")
    ).reverse();

    for (let overflownViewEl of overflownViewEls) {
      let view = overflownViewEl.view;
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
