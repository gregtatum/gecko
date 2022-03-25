/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import ActiveViewManager from "chrome://browser/content/companion/components/active-view-manager.js";

export default class Workspace extends window.MozHTMLElement {
  #river;
  #pinnedViews;
  #urlbar;
  #id;
  #workspace;

  get overflowedViews() {
    return this.#river.overflowedViews;
  }

  set dragging(value) {
    this.#pinnedViews.dragging = value;
  }

  connectedCallback() {
    let template = document.getElementById("template-workspace");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);

    this.#river = this.querySelector("river-el");
    this.#pinnedViews = this.querySelector("pinned-views");
    this.#urlbar = document.getElementById("urlbar");
    this.addEventListener("dragstart", this);
    this.addEventListener("dragend", this);
    this.addEventListener("click", this);
    window.gGlobalHistory.addEventListener("RiverRebuilt", this);

    this.#id = this.getAttribute("workspace-id");
    this.#updateSearchWorkspace();

    this.#workspace = this.querySelector("#workspace");
    this.#workspace.setAttribute("empty", true);
  }

  disconnectedCallback() {
    this.removeEventListener("dragstart", this);
    this.removeEventListener("dragend", this);
    this.removeEventListener("click", this);
  }

  #updateSearchWorkspace() {
    if (!Number.isInteger(parseInt(this.#id))) {
      console.error(
        "Something went wrong! Could not assign search with the correct workspace id."
      );
      return;
    }

    this.#urlbar.setAttribute("workspace-id", this.#id);
  }

  setActiveView(view) {
    this.#river.activeView = null;
    this.#pinnedViews.activeView = null;

    if (this.isRiverView(view)) {
      this.#river.activeView = view;
      this.#updateSearchWorkspace();
    } else if (this.isPinnedView(view)) {
      this.#pinnedViews.activeView = view;
      this.#updateSearchWorkspace();
    }
  }

  #isEmpty() {
    return this.#river.isEmpty() && this.#pinnedViews.isEmpty();
  }

  update(riverViewGroups = [], overflowedViews = [], pinnedViewGroups = []) {
    this.#river.viewGroups = riverViewGroups;
    this.#river.overflowedViews = overflowedViews;
    this.#pinnedViews.viewGroups = pinnedViewGroups;
    this.#workspace.setAttribute("empty", this.#isEmpty());
  }

  isRiverView(view) {
    return this.#river.hasView(view);
  }

  isPinnedView(view) {
    return this.#pinnedViews.hasView(view);
  }

  #onDragStart(event) {
    let draggedViewGroup = this.#getEventViewGroup(event);
    if (!draggedViewGroup) {
      return;
    }

    // Hack needed so that the dragimage will still show the
    // item as it appeared before it was hidden.
    window.requestAnimationFrame(() => {
      draggedViewGroup.setAttribute("dragging", "true");
    });

    this.dragging = true;

    let dt = event.dataTransfer;

    // Because we're relying on Lit to manipulate the DOM, we can
    // run into situations where the dragend event fails to fire if
    // the dragged ViewGroup element has been detached from the DOM,
    // which seems to occur sometimes when Lit decides that a pre-exiting
    // ViewGroup can be repurposed rather than being replaced with the
    // dragged ViewGroup.
    //
    // To work around this, we use the addElement API to make sure that
    // the dragend event fires on the Workspace.
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

    this.dragging = false;
  }

  #getEventViewGroup(event) {
    let node = event.composedTarget;
    let host = node.getRootNode().host;
    if (host.localName == "view-group") {
      return host;
    }

    return null;
  }

  handleEvent(event) {
    switch (event.type) {
      case "click": {
        if (event.target.id == "workspace-indicator-button") {
          if (this.#isEmpty()) {
            this.#updateSearchWorkspace();
            window.gGlobalHistory.loadEmptyWorkspace(this.#id);
          }
        }
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
    }
  }
}

customElements.define("workspace-el", Workspace);
