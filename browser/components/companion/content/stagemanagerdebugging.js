/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

export class StageManagerDebugging extends HTMLElement {
  constructor() {
    super();
    this.render = this.render.bind(this);
    let listTitle = document.createElement("h2");
    listTitle.setAttribute("class", "list-title");
    listTitle.textContent = "Stage Manager";

    let historyList = document.createElement("ul");
    historyList.setAttribute("class", "history-list");

    this.appendChild(listTitle);
    this.appendChild(historyList);
  }

  connectedCallback() {
    window.addEventListener("Companion:StageManagerEvent", this.render);
    this.render();
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:StageManagerEvent", this.render);
  }

  get enabled() {
    return window.CompanionUtils.getBoolPref(
      "browser.companion.stagemanagerdebugging"
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
    let views = window.CompanionUtils.stageManager;
    let elements = [];
    views.forEach(view => {
      let item = document.createElement("li");
      item.textContent = view.title;
      item.className = "history-entry";

      item.classList.add(view.state);
      if (view.isCurrent) {
        item.classList.add("visible");
      }

      let tooltip =
        `URI: ${view.urlSpec}\n` +
        `Index: ${view.index}\n` +
        `Workspace: ${view.workspaceId}\n` +
        `${JSON.stringify(view.historyState, null, "\n")}`;

      item.title = tooltip;

      elements.push(item);

      item.addEventListener("click", () =>
        window.CompanionUtils.sendAsyncMessage(
          "Companion:SetStageManagerViewIndex",
          { index: view.index }
        )
      );
    });

    this.list.replaceChildren(...elements);
  }
}

customElements.define("e-global-nav-debugging", StageManagerDebugging);
