/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { timeSince } from "./time-since.js";
import { noteTelemetryTimestamp } from "./telemetry-helpers.js";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const MAX_SNAPSHOTS = 5;
const DEFAULT_FAVICON = "chrome://global/skin/icons/defaultFavicon.svg";

function pickColorFromImage(icon) {
  let canvas = document.createElement("canvas");
  let ctx = canvas.getContext("2d");

  // Make small canvas so enough to spread some colours but will not take
  // too long to process.
  let width = 24;
  let height = 24;
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(icon, 0, 0, width, height, 0, 0, width, height);

  let colors = {};
  let data = ctx.getImageData(0, 0, width, height).data;

  for (let i = 0; i < data.length; i += 4) {
    let key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    colors[key] = key in colors ? colors[key] + 1 : 1;
  }
  canvas.remove();
  return Object.entries(colors).sort((a, b) => b[1] - a[1])[0];
}

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

    let iconEl = fragment.querySelector(".card-image > img.favicon");
    let iconSrc = window.CompanionUtils.getFavicon(url.href);
    iconEl.src = iconSrc ?? DEFAULT_FAVICON;

    let previewEl = fragment.querySelector(".card-image");
    if (preview) {
      previewEl.style.backgroundImage = "url('" + preview + "')";
    } else {
      this.classList.add("nopreview");
    }

    let contents = fragment.querySelector(".snapshot-contents");
    contents.href = this.data.url;

    this.appendChild(fragment);
    this.addEventListener("click", this);
    this.addEventListener("contextmenu", this);

    if (!preview && iconSrc) {
      let primaryIconColor = pickColorFromImage(iconEl);
      if (primaryIconColor) {
        previewEl.style.backgroundColor = `rgb(${primaryIconColor})`;
      }
    }
  }

  handleEvent(event) {
    const togglePanel = () => {
      let panel = this.querySelector("panel-list");
      if (!panel.open) {
        this.classList.add("popupshowing");
        panel.addEventListener(
          "hidden",
          () => {
            this.classList.remove("popupshowing");
            if (panel.contains(document.activeElement)) {
              Services.focus.setFocus(
                this.querySelector(".snapshot-contents"),
                Services.focus.FLAG_BYKEY
              );
            }
          },
          { once: true }
        );
      }
      panel.toggle(event);
    };
    switch (event.type) {
      case "click": {
        switch (event.target.dataset.action) {
          case "toggle-panel":
            togglePanel();
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
        break;
      }
      case "contextmenu": {
        togglePanel();
        break;
      }
    }

    event.preventDefault();
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
    this.snapshots = [];
  }

  handleEvent({ type, detail }) {
    switch (type) {
      case "Companion:SnapshotsChanged": {
        let { snapshots } = detail;
        this.snapshots = snapshots;
        this.updateSnapshots(this.snapshots.slice(0, MAX_SNAPSHOTS));
        noteTelemetryTimestamp("Companion:SuggestedSnapshotsPainted", {
          numberOfSnapshots: this.snapshots.length,
        });
        break;
      }
    }
  }

  connectedCallback() {
    window.addEventListener("Companion:SnapshotsChanged", this);
    this.updateSnapshots(this.snapshots.slice(0, MAX_SNAPSHOTS));
    // This should generally be false. However, in case anything changes in the
    // future and we're able to get snapshots by the time of connectedCallback,
    // we want to be able to see it in our telemetry.
    if (this.snapshots.length) {
      noteTelemetryTimestamp("Companion:SuggestedSnapshotsPainted", {
        numberOfSnapshots: this.snapshots.length,
      });
    }
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:SnapshotsChanged", this);
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
