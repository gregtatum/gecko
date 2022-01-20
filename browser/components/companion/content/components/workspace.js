/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export default class Workspace extends window.MozHTMLElement {
  #river;
  #pinnedViews;
  #overflow;

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
    this.#overflow = this.querySelector("#river-overflow-button");
    window.gGlobalHistory.addEventListener("RiverRebuilt", this);
    this.addEventListener("RiverRegrouped", this);
  }

  disconnectedCallback() {
    window.gGlobalHistory.removeEventListener("RiverRebuilt", this);
    this.removeEventListener("RiverRegrouped");
  }

  setActiveView(view) {
    this.#river.activeView = null;
    this.#pinnedViews.activeView = null;
    if (this.isRiverView(view)) {
      this.#river.activeView = view;
    } else if (this.isPinnedView(view)) {
      this.#pinnedViews.activeView = view;
    } else {
      console.warn("Saw setActiveView for an unknown view.");
    }
  }

  updateView(view) {
    if (this.isPinnedView(view)) {
      this.#pinnedViews.requestUpdate();
    } else if (this.isRiverView(view)) {
      this.#river.viewUpdated();
    } else {
      console.warn("Saw ViewUpdated for an unknown view.");
    }
  }

  addView(view, pin = false, atIndex = null) {
    if (pin) {
      this.#pinnedViews.addView(view, atIndex);
    } else {
      this.#river.addView(view);
    }
  }

  removeView(view) {
    if (this.isPinnedView(view)) {
      this.#pinnedViews.removeView(view);
    } else if (this.isRiverView(view)) {
      this.#river.removeView(view);
    } else {
      console.warn("Saw ViewRemoved for an unknown view.");
    }
  }

  moveView(view) {
    if (this.isRiverView(view)) {
      this.#river.addView(view);
      this.#river.activeView = view;
    } else {
      console.warn("Saw ViewMoved for an unknown view.");
    }
  }

  isRiverView(view) {
    return this.#river.hasView(view);
  }

  isPinnedView(view) {
    return this.#pinnedViews.hasView(view);
  }

  handleEvent(event) {
    if (event.type == "RiverRebuilt") {
      this.#river.setViews(window.gGlobalHistory.views);
      this.#pinnedViews.clear();
      this.setActiveView(window.gGlobalHistory.currentView);
    } else if (event.type == "RiverRegrouped") {
      let l10nId = this.#overflow.getAttribute("data-l10n-id");
      let count = event.detail.overflowCount;
      document.l10n.setAttributes(this.#overflow, l10nId, { count });
      this.#overflow.hidden = count == 0;
    }
  }
}

customElements.define("workspace-el", Workspace);
