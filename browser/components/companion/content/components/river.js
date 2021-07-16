/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class River extends HTMLElement {
  #river;
  #overflow;
  connectedCallback() {
    this.views = new Map();
    this.#river = document.querySelector("#river");
    this.#overflow = document.querySelector("#overflow");
    this.#overflow.hidden = true;
  }

  showOrHideOverflowButton() {
    const RIVER_ITEMS_LIMIT = 5;
    if (this.views.size > RIVER_ITEMS_LIMIT) {
      this.#overflow.hidden = false;
      this.#overflow.textContent = "+" + (this.views.size - RIVER_ITEMS_LIMIT);
    } else {
      this.#overflow.hidden = true;
    }
  }

  addView(view) {
    if (!view) {
      return;
    }

    if (this.views.has(view)) {
      console.warn("Saw ViewAdded for an existing view.");
    }

    let viewEl = document.createElement("view-el");
    this.#river.appendChild(viewEl);
    this.views.set(view, viewEl);
    viewEl.update(view);
    this.showOrHideOverflowButton();
  }

  removeView(view) {
    if (!view || !this.views.get(view)) {
      console.warn("Saw ViewRemoved for an unknown view.");
      return;
    }

    let viewEl = this.views.get(view);
    this.#river.removeChild(viewEl);
    this.views.delete(view);
    this.showOrHideOverflowButton();
  }

  set activatedView(view) {
    if (this.activeView == view) {
      // The right view is already active.
      return;
    }

    if (!view) {
      // Close the current active view in the river.
      let viewEl = this.views.get(this.activeView);
      viewEl.removeAttribute("active");
      this.activeView = null;
    } else {
      if (this.activeView) {
        let activeViewEl = this.views.get(this.activeView);
        activeViewEl.removeAttribute("active");
      }

      let viewEl = this.views.get(view);
      if (!viewEl) {
        console.warn(
          "Tried to activate a view in the river that doesn't exist"
        );
        return;
      }

      viewEl.setAttribute("active", "true");
      this.activeView = view;

      // Scroll to the active view.
      viewEl.scrollIntoView({ behavior: "smooth", inline: "start" });
    }
  }
}
customElements.define("river-el", River);
