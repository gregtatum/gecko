/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class ActiveViewManager extends HTMLElement {
  constructor() {
    super();

    this.handleEvent = this.handleEvent.bind(this);
    this.updateActiveView = this.updateActiveView.bind(this);
    this.viewAdded = this.viewAdded.bind(this);
    this.viewChanged = this.viewChanged.bind(this);
    this.viewMoved = this.viewMoved.bind(this);
    this.viewRemoved = this.viewRemoved.bind(this);
  }

  connectedCallback() {
    // Set up the active view manager UI.
    let template = document.getElementById("template-active-view-manager");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);

    // Set up an initial view element.
    this.viewManager = this.querySelector("#active-view-manager");
    let initialView = document.createElement("view-el");
    this.viewManager.appendChild(initialView);
    this.updateActiveView(initialView);

    // Setup a map to store all views shown to the user. Do not add the initial
    // view element to the map yet. We will add it when "ViewAdded" is fired i.e.
    // when the user has visited a website for the first time.
    this.views = new Map();

    // Add listeners for events coming from GlobalHistory.
    for (let event of [
      "ViewChanged",
      "ViewAdded",
      "ViewRemoved",
      "ViewMoved",
    ]) {
      window.top.gGlobalHistory.addEventListener(event, e =>
        this.handleEvent(e)
      );
    }
  }

  disconnectedCallback() {
    window.top.gGlobalHistory.removeEventListener(
      "ViewAdded",
      this.handleEvent
    );
    window.gGlobalHistory.removeEventListener("ViewMoved", this.handleEvent);
    window.gGlobalHistory.removeEventListener("ViewRemoved", this.handleEvent);
    window.gGlobalHistory.removeEventListener("ViewChanged", this.handleEvent);
  }

  updateActiveView(viewElToActivate) {
    if (!viewElToActivate) {
      viewElToActivate = this.viewManager.lastChild;
    }

    if (viewElToActivate == this.activeView) {
      return;
    }

    this.activeView?.querySelector(".view-el").classList.remove("active");
    let viewEl = viewElToActivate.querySelector(".view-el");
    viewEl.classList.add("active");
    this.activeView = viewElToActivate;

    // Scroll to the active view.
    // TODO: Figure out how to do this auto-scroll after the animation is complete.
    // It doesn't scroll and focus very accurately.
    let scrollToPos =
      viewEl.getBoundingClientRect().x -
      this.viewManager.getBoundingClientRect().x;
    this.viewManager.scrollLeft = scrollToPos;
  }

  viewAdded(view) {
    // TODO: Handle the edge case where a view is already present for the newly added
    // URL in our views map. We might have to move that view to the front of the river
    // and display it. Global History probably makes sure to not add duplicate views.

    // Add the new view to the map and append the view element to the active view manager.
    // Note: If this is the first view being added to the map, we should edit the existing
    // new-tab-like view element instead of appending a new view element to the active view manager.
    if (!this.views.size && this.viewManager.children.length === 1) {
      let initialViewEl = this.viewManager.children[0];
      this.views.set(view, initialViewEl);

      this.updateActiveView(initialViewEl);
    } else {
      let viewEl = document.createElement("view-el");
      this.views.set(view, viewEl);
      this.viewManager.appendChild(viewEl);

      this.updateActiveView(viewEl);
    }
  }

  viewChanged(view) {
    // TODO: Handle edge case where a view might not be present in the map.

    let viewElToActivate = this.views.get(view);
    this.updateActiveView(viewElToActivate);
  }

  viewMoved(view) {
    // TODO: Handle edge case where a view might not be present. We can
    // probably trust Global History to take care of this.

    // TODO: Show a moving animation.

    let viewElToMove = this.views.get(view);
    if (!viewElToMove) {
      return;
    }

    this.viewManager.removeChild(viewElToMove);
    this.viewManager.appendChild(viewElToMove);
    this.updateActiveView(viewElToMove);
  }

  viewRemoved(view) {
    // TODO: Ask mossop if we're supporting users removing specific views like closing a tab.

    let viewElToRemove = this.views.get(view);
    this.viewManager.removeChild(viewElToRemove);
    this.updateActiveView();
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
    }
  }
}
customElements.define("active-view-manager", ActiveViewManager);
