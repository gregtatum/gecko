/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Snapshot } from "./snapshots.js";

let currentSnapshotGroupData = null;

class SnapshotGroupCard extends Snapshot {
  constructor(data) {
    super(data);
    this.className = "snapshot-group card";
  }
  cardClicked() {
    document.getElementById("companion-deck").selectedViewName =
      "snapshot-groups-detail";
    currentSnapshotGroupData = this.data;
    window.CompanionUtils.sendAsyncMessage(
      "Companion:FetchSnapshotGroupDetails",
      {
        id: this.data.id,
      }
    );
  }
}

export class SnapshotGroupList extends HTMLElement {
  constructor() {
    super();
    this.className = "snapshot-group-list";

    let template = document.getElementById("template-session-list");
    let fragment = template.content.cloneNode(true);

    this.appendChild(fragment);
  }

  async render(data) {
    let panel = this.querySelector(".last-sessions-panel");
    let fragment = new DocumentFragment();
    for (const group of data) {
      let url = new URL(group.url);
      let values = [
        { id: "snapshot-count", args: { snapshotCount: group.snapshotCount } },
      ];
      if (group.builderMetadata?.fluentTitle) {
        values.push(group.builderMetadata.fluentTitle);
      }
      let [subTitle, title] = await document.l10n.formatValues(values);
      fragment.appendChild(
        new SnapshotGroupCard({
          id: group.id,
          title: group.title || title,
          snapshotCount: group.snapshotCount,
          subTitle,
          lastInteractionAt: group.lastAccessed,
          faviconSelector: "img.inline-favicon",
          faviconImage: window.CompanionUtils.getFavicon(url.href),
          url: group.url,
          image: group.image,
        })
      );
    }
    if (panel) {
      panel.replaceChildren(fragment);
    }
  }

  connectedCallback() {
    window.addEventListener("Companion:SnapshotGroupsData", this);
    window.addEventListener("Companion:SnapshotGroupsChanged", this);
    window.CompanionUtils.sendAsyncMessage("Companion:FetchSnapshotGroups");
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:SnapshotGroupsData", this);
    window.removeEventListener("Companion:SnapshotGroupsChanged", this);
  }

  handleEvent(event) {
    switch (event.type) {
      case "Companion:SnapshotGroupsData": {
        this.render(event.detail);
        break;
      }
      case "Companion:SnapshotGroupsChanged": {
        window.CompanionUtils.sendAsyncMessage("Companion:FetchSnapshotGroups");
        break;
      }
    }
  }
}

export class SnapshotGroupListDetail extends HTMLElement {
  constructor() {
    super();
    this.className = "snapshot-group-list";

    let template = document.getElementById("template-snapshot-list-details");
    let fragment = template.content.cloneNode(true);

    this.appendChild(fragment);
  }

  handleEvent(event) {
    switch (event.type) {
      case "Companion:SnapshotGroupsDetails": {
        this.render(event.detail);
        break;
      }
    }
  }

  async render(data) {
    this.querySelector(".details h2").textContent =
      currentSnapshotGroupData.title;
    this.querySelector(
      ".details h3"
    ).textContent = await document.l10n.formatValue("snapshot-count", {
      snapshotCount: currentSnapshotGroupData.snapshotCount,
    });
    this.querySelector(".details img").src = currentSnapshotGroupData.image;

    let panel = this.querySelector("#snapshot-list");
    let fragment = new DocumentFragment();
    for (const snapshot of data) {
      snapshot.preventHoverPanel = true;
      fragment.appendChild(new Snapshot(snapshot));
    }
    if (panel) {
      panel.replaceChildren(fragment);
    }
  }

  connectedCallback() {
    window.addEventListener("Companion:SnapshotGroupsDetails", this);
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:SnapshotGroupsDetails", this);
  }
}

customElements.define("e-snapshot-group-list", SnapshotGroupList);
customElements.define("e-snapshot-group-card", SnapshotGroupCard);
customElements.define("e-snapshot-group-list-detail", SnapshotGroupListDetail);
