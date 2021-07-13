/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class ActiveViewManager extends HTMLElement {
  /** @type {<html:button>} */
  #overflow;
  /** @type {<xul:panel>} */
  #overflowPanel;

  static EVENTS = [
    "ViewChanged",
    "ViewAdded",
    "ViewRemoved",
    "ViewMoved",
    "ViewUpdated",
  ];

  connectedCallback() {
    // Set up the active view manager UI.
    let template = document.getElementById("template-active-view-manager");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);

    // Set up an initial view element.
    this.viewManager = this.querySelector("#active-view-manager");
    this.#overflow = this.querySelector(".overflow");
    let initialView = document.createElement("view-el");
    this.viewManager.insertBefore(initialView, this.#overflow);
    this.updateActiveView(initialView);

    // Setup a map to store all views shown to the user. Do not add the initial
    // view element to the map yet. We will add it when "ViewAdded" is fired i.e.
    // when the user has visited a website for the first time.
    this.views = new Map();

    // Add listeners for events coming from GlobalHistory.
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

  updateActiveView(viewElToActivate) {
    if (!viewElToActivate) {
      viewElToActivate = this.viewManager.querySelector("view-el:last-of-type");
    }

    if (viewElToActivate != this.activeView) {
      this.activeView?.removeAttribute("active");
      viewElToActivate.setAttribute("active", "true");
      this.activeView = viewElToActivate;
    }

    viewElToActivate.scrollIntoView({ behavior: "smooth", inline: "start" });
  }

  viewAdded(view) {
    // TODO: Handle the edge case where a view is already present for the newly added
    // URL in our views map. We might have to move that view to the front of the river
    // and display it. Global History probably makes sure to not add duplicate views.
    if (this.views.has(view)) {
      console.warn("Saw ViewAdded for an existing view.");
    }

    // Add the new view to the map and append the view element to the active view manager.
    // Note: If this is the first view being added to the map, we should edit the existing
    // new-tab-like view element instead of appending a new view element to the active view manager.
    let viewEls = this.viewManager.querySelectorAll("view-el");
    if (!this.views.size && viewEls.length === 1) {
      let initialViewEl = viewEls[0];
      this.views.set(view, initialViewEl);
      initialViewEl.update(view);

      this.updateActiveView(initialViewEl);
    } else {
      let viewEl = document.createElement("view-el");
      this.views.set(view, viewEl);
      this.viewManager.insertBefore(viewEl, this.#overflow);
      viewEl.update(view);

      this.updateActiveView(viewEl);
    }
  }

  viewChanged(view) {
    // TODO: Handle edge case where a view might not be present in the map.

    let viewElToActivate = this.views.get(view);
    if (!viewElToActivate) {
      console.warn("Saw ViewChanged for an unknown view.");
      return;
    }

    this.updateActiveView(viewElToActivate);
  }

  viewMoved(view) {
    // TODO: Handle edge case where a view might not be present. We can
    // probably trust Global History to take care of this.

    // TODO: Show a moving animation.

    let viewElToMove = this.views.get(view);
    if (!viewElToMove) {
      console.warn("Saw ViewMoved for an unknown view.");
      return;
    }

    this.viewManager.insertBefore(viewElToMove, this.#overflow);
    this.updateActiveView(viewElToMove);
  }

  viewRemoved(view) {
    // TODO: Ask mossop if we're supporting users removing specific views like closing a tab.

    let viewElToRemove = this.views.get(view);
    if (!viewElToRemove) {
      console.warn("Saw ViewRemoved for an unknown view.");
      return;
    }

    this.viewManager.removeChild(viewElToRemove);
    this.updateActiveView();
    this.views.delete(view);
  }

  viewUpdated(view) {
    let viewElToUpdate = this.views.get(view);
    if (!viewElToUpdate) {
      console.warn("Saw ViewUpdated for an unknown view.");
      return;
    }

    viewElToUpdate.update(view);
  }

  handleEvent(event) {
    switch (event.type) {
      case "ViewAdded":
        this.viewAdded(event.view);
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
    let viewEl = this.views.get(view);
    this.updateActiveView(viewEl);
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
    // See active-view-manager.css for an explanation for the n + 7 magic
    // number.
    let overflownViewEls = Array.from(
      this.viewManager.querySelectorAll("view-el:nth-last-of-type(n + 7)")
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
