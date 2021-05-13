/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

const { CompanionGlobalHistory } = ChromeUtils.import(
  "resource:///modules/CompanionGlobalHistory.jsm"
);

export class GlobalHistoryDebugging extends HTMLElement {
  constructor(title) {
    super();
    this.render = this.render.bind(this);
    this.title = title;
    this.innerHTML = `
      <h2 class="list-title"></h2>
      <div class="debug-container">
      </div>
    `;
    this.querySelector(".list-title").textContent = title;
  }
  connectedCallback() {
    this.render();
    document.addEventListener("CompanionObservedPrefChanged", this.render);
    CompanionGlobalHistory.addEventListener(
      "CompanionGlobalHistoryChange",
      this.render
    );
  }
  disconnectedCallback() {
    document.removeEventListener("CompanionObservedPrefChanged", this.render);
    CompanionGlobalHistory.removeEventListener(
      "CompanionGlobalHistoryChange",
      this.render
    );
  }

  get container() {
    return this.querySelector(".debug-container");
  }

  get enabled() {
    return Services.prefs.getBoolPref(
      "browser.companion.globalhistorydebugging"
    );
  }

  render() {
    if (!this.enabled) {
      this.hidden = true;
      return;
    }

    this.hidden = false;
    let globalhistory = CompanionGlobalHistory.historyForWindow(window.top);

    console.debug(`CompanionGlobalHistoryDebug: render`, globalhistory);
    this.container.textContent = globalhistory._history
      .map((h, i) => {
        let selected =
          globalhistory._history.length - globalhistory._historyDepth - 1 == i;
        return `${selected ? "->" : ""}${h.plainURI} - ${h.tab?.linkedPanel}`;
      })
      .join("\n");
  }
}

customElements.define("e-global-nav-debugging", GlobalHistoryDebugging);
