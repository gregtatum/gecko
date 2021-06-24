/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

export class GlobalHistoryDebugging extends HTMLElement {
  constructor() {
    super();
    this.render = this.render.bind(this);
    let listTitle = document.createElement("h2");
    listTitle.setAttribute("class", "list-title");
    listTitle.textContent = "Global History";

    let historyList = document.createElement("ul");
    historyList.setAttribute("class", "history-list");

    this.appendChild(listTitle);
    this.appendChild(historyList);
  }

  connectedCallback() {
    this.render();
    document.addEventListener("CompanionObservedPrefChanged", this.render);

    for (let event of [
      "ViewChanged",
      "ViewAdded",
      "ViewRemoved",
      "ViewUpdated",
      "ViewMoved",
    ]) {
      window.top.gGlobalHistory.addEventListener(event, () => this.render());
    }
  }

  disconnectedCallback() {
    document.removeEventListener("CompanionObservedPrefChanged", this.render);
  }

  get enabled() {
    return Services.prefs.getBoolPref(
      "browser.companion.globalhistorydebugging"
    );
  }

  get list() {
    return this.querySelector(".history-list");
  }

  render() {
    if (!this.enabled) {
      this.hidden = true;
      return;
    }

    this.hidden = false;
    let history = window.top.gGlobalHistory;
    let { views, currentView } = history;
    let elements = [];
    views.forEach(view => {
      let item = document.createElement("li");
      item.textContent = view.title;
      item.className = "history-entry";

      item.classList.add(view.state);
      if (view === currentView) {
        item.classList.add("visible");
      }

      elements.push(item);

      item.addEventListener("click", () =>
        window.top.gGlobalHistory.setView(view)
      );
    });

    this.list.replaceChildren(...elements);
  }
}

customElements.define("e-global-nav-debugging", GlobalHistoryDebugging);
