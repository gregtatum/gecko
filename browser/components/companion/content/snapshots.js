/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { timeSince } from "./time-since.js";

const MAX_SNAPSHOTS = 5;
const DEFAULT_FAVICON = "chrome://global/skin/icons/defaultFavicon.svg";

class HidableElement extends HTMLElement {
  get hidden() {
    return this.hasAttribute("hidden");
  }

  set hidden(val) {
    if (val) {
      this.setAttribute("hidden", "true");
    } else {
      this.removeAttribute("hidden");
    }
  }
}

export class Snapshot extends HTMLElement {
  constructor(data, preview) {
    super();
    this.data = data;
    this.className = "snapshot card";

    let template = document.getElementById("template-snapshot");
    let fragment = template.content.cloneNode(true);

    let url = new URL(this.data.url);
    let titleEl = fragment.querySelector(".title");
    titleEl.textContent = this.data.title || url.href;

    let siteTitleEl = fragment.querySelector(".snapshot-sitetitle");
    siteTitleEl.textContent = this.data.commonName;

    let dateEl = fragment.querySelector(".snapshot-date");
    dateEl.textContent = timeSince(this.data.lastInteractionAt);

    if (preview) {
      let previewEl = fragment.querySelector(".card-image");
      previewEl.style.backgroundImage = "url('" + preview + "')";
    }

    let iconEl = fragment.querySelector(".card-image > img.favicon");
    iconEl.src = window.CompanionUtils.getFavicon(url.href) ?? DEFAULT_FAVICON;

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  handleEvent(event) {
    switch (event.type) {
      case "click": {
        switch (event.target.dataset.action) {
          case "toggle-panel":
            this.querySelector("panel-list").toggle(event);
            break;
          case "dont-show":
          case "not-relevant":
            window.CompanionUtils.sendAsyncMessage("Companion:DeleteSnapshot", {
              url: this.data.url,
            });
            break;
          default:
            window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
              url: this.data.url,
            });
        }
      }
    }
  }
}

export class SnapshotList extends HidableElement {
  constructor(snapshotTitle) {
    super();
    this.className = "snapshot-list";

    let template = document.getElementById("template-snapshot-list");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".list-title").textContent = snapshotTitle;

    this.appendChild(fragment);
  }

  updateSnapshots(snapshots) {
    let panel = this.querySelector(".snapshots-panel");
    let nodes = [];
    this.hidden = !snapshots.length;
    for (let { snapshot, preview } of snapshots) {
      nodes.push(new Snapshot(snapshot, preview));
    }

    panel.replaceChildren(...nodes);
  }
}

export class SuggestedSnapshotList extends SnapshotList {
  constructor(snapshotTitle) {
    super(snapshotTitle);

    this.dbListener = () =>
      this.updateSnapshots(
        window.CompanionUtils.snapshots.slice(0, MAX_SNAPSHOTS)
      );
  }

  async connectedCallback() {
    window.addEventListener("Companion:SnapshotsChanged", this.dbListener);
    this.updateSnapshots(
      window.CompanionUtils.snapshots.slice(0, MAX_SNAPSHOTS)
    );
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:SnapshotsChanged", this.dbListener);
  }
}

export class RecentlyClosedSnapshotList extends SnapshotList {
  constructor(snapshotTitle) {
    super(snapshotTitle);
  }

  async connectedCallback() {
    // TODO: H&M to populate with recently closed river contents
    let recentlyClosedSnapshots = [];
    this.updateSnapshots(recentlyClosedSnapshots);
  }
}

customElements.define("e-snapshot", Snapshot);
customElements.define("e-suggested-snapshot-list", SuggestedSnapshotList);
customElements.define("e-recent-snapshot-list", RecentlyClosedSnapshotList);
