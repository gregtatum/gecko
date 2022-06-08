/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

export class BrowseList extends HTMLElement {
  constructor() {
    super();

    let template = document.getElementById("template-browse-list");
    let fragment = template.content.cloneNode(true);

    fragment.querySelectorAll("button[data-pref]").forEach(el => {
      el.hidden = !Services.prefs.getBoolPref(el.dataset.pref, false);
    });

    this.appendChild(fragment);

    // If the user manually chooses the "History" button, for now, we'll
    // interpret this as a request for all recent history results.
    this.querySelector("button.history").addEventListener("click", e => {
      window.gHistorySearch.doQuery("");
    });
  }
}

customElements.define("browse-list", BrowseList);
