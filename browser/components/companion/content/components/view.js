/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class ViewElement extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    if (!this.built) {
      let template = document.getElementById("template-view");
      let fragment = template.content.cloneNode(true);
      this.appendChild(fragment);
      this.built = true;
    }

    this.update();
  }

  update(view) {
    if (view) {
      this.view = view;
    }

    let title = this.view?.title ?? "Newtab";
    let titleEl = this.querySelector(".view-title");
    titleEl.textContent = title;
    titleEl.tooltipText = title;

    let domain = "";
    try {
      domain = this.view?.url.host ?? "";
    } catch (e) {}
    let domainEl = this.querySelector(".view-domain");
    domainEl.textContent = domain;
  }
}
customElements.define("view-el", ViewElement);
