/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

class ViewElement extends HTMLElement {
  connectedCallback() {
    if (!this.built) {
      let template = document.getElementById("template-view");
      let fragment = template.content.cloneNode(true);
      this.appendChild(fragment);
      this.built = true;
    }

    this.update();
    this.addEventListener("click", this);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this);
  }

  update(view) {
    if (view) {
      this.view = view;
    }

    let title = this.view?.title ?? "Newtab";
    this.setAttribute("title", title);

    let titleEl = this.querySelector(".view-title");
    titleEl.textContent = title;

    if (this.view) {
      let iconEl = this.querySelector(".view-icon");

      // If the View has an iconURL, this means the page has potentially set
      // a favicon within its markup. If we don't have that, we fallback to
      // using the page-icon protocol to try to fetch the right favicon from
      // the Favicon service.
      if (this.view.iconURL) {
        iconEl.setAttribute("src", this.view.iconURL);
      } else {
        iconEl.setAttribute("src", `page-icon:${this.view?.url.spec}`);
      }
    }

    let domain = "";
    try {
      domain = this.view?.url.host ?? "";
    } catch (e) {}
    let domainEl = this.querySelector(".view-domain");
    domainEl.textContent = domain;
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
customElements.define("view-el", ViewElement);
