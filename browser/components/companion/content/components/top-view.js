/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class TopView extends HTMLElement {
  connectedCallback() {
    this.update();
    this.addEventListener("click", this);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this);
  }

  update(view) {
    let oldView = this.view;

    if (view) {
      this.view = view;
    }

    let title = this.view?.title ?? "Newtab";
    let titleEl = this.querySelector(".top-view-title");
    titleEl.textContent = title;
    titleEl.tooltipText = title;

    return oldView;
  }

  handleEvent(event) {
    if (event.type != "click") {
      return;
    }

    let e = new CustomEvent("UserAction:ViewSelected", {
      bubbles: true,
      detail: { clickedView: this.view },
    });
    this.dispatchEvent(e);
  }
}
customElements.define("top-view", TopView);
