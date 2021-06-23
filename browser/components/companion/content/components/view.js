/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class ViewElement extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    let template = document.getElementById("template-view");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);

    let title = window.gBrowser?.selectedTab.getAttribute("label") || "Newtab";
    let titleEl = this.querySelector(".view-title");
    titleEl.textContent = title;
    titleEl.tooltipText = title;

    let domain = "";
    try {
      domain = window.gBrowser.currentURI.host;
    } catch (e) {
      domain = "about:page";
    }
    let domainEl = this.querySelector(".view-domain");
    domainEl.textContent = domain;
  }
}
customElements.define("view-el", ViewElement);
