/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

export class BrowseList extends HTMLElement {
  constructor() {
    super();

    let template = document.getElementById("template-browse-list");
    let fragment = template.content.cloneNode(true);
    this.appendChild(fragment);

    this.addEventListener("click", this);

    document.querySelectorAll("[data-tab]").forEach(el => {
      el.addEventListener("click", this);
    });
  }

  handleEvent(event) {
    switch (event.target.dataset.action) {
      case "viewtab": {
        document.getElementById("companion-deck").selectedViewName =
          event.target.dataset.tab;
      }
    }
  }
}

customElements.define("browse-list", BrowseList);
