/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { timeSince } from "./time-since.js";
import { noteTelemetryTimestamp } from "./telemetry-helpers.js";

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const lazy = {};

XPCOMUtils.defineLazyModuleGetters(lazy, {
  UpdateUtils: "resource://gre/modules/UpdateUtils.jsm",
});

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
  constructor(data) {
    super();
    this.data = data;
    this.className = "snapshot card";

    let template = document.getElementById("template-snapshot");
    let fragment = template.content.cloneNode(true);

    let titleEl = fragment.querySelector(".title");
    titleEl.textContent = this.data.title;

    let siteTitleEl = fragment.querySelector(".snapshot-sitetitle");
    siteTitleEl.textContent = this.data.commonName || this.data.subTitle;

    let dateEl = fragment.querySelector(".snapshot-date");
    dateEl.textContent = timeSince(this.data.lastInteractionAt);

    if (!this.data.faviconImage) {
      let url = new URL(this.data.url);
      this.data.faviconImage = window.CompanionUtils.getFavicon(url.href);
    }

    let iconEl = fragment.querySelector(
      this.data.faviconSelector || "img.favicon"
    );
    iconEl.src = this.data.faviconImage ?? DEFAULT_FAVICON;
    iconEl.hidden = false;

    let previewEl = fragment.querySelector(".card-image");
    if (data.image) {
      previewEl.style.backgroundImage = "url('" + data.image + "')";
    } else {
      this.classList.add("nopreview");
    }

    if (data.preventHoverPanel) {
      this.classList.add("prevent-hover-panel");
    }

    this.appendChild(fragment);
    this.addEventListener("click", this);
    this.addEventListener("contextmenu", this);
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
          case "dismiss":
            window.CompanionUtils.sendAsyncMessage(
              "Companion:DismissSnapshot",
              {
                url: this.data.url,
              }
            );
            break;
          case "not-relevant":
            window.CompanionUtils.sendAsyncMessage(
              "Companion:NotRelevantSnapshot",
              {
                url: this.data.url,
              }
            );
            break;
          case "personal":
            window.CompanionUtils.sendAsyncMessage(
              "Companion:PersonalSnapshot",
              {
                url: this.data.url,
              }
            );
            break;
          default:
            this.cardClicked();
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

  cardClicked() {
    window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
      url: this.data.url,
    });
  }
}

class Recommendation extends Snapshot {
  constructor(data, source, score) {
    super(data);

    if (
      ["nightly-pine-experimental", "default"].includes(
        lazy.UpdateUtils.UpdateChannel
      )
    ) {
      this.setAttribute("title", `Score ${score.toFixed(2)} (${source})`);
    }
  }
}

class SnapshotList extends HidableElement {
  constructor(snapshotTitle) {
    super();
    this.className = "snapshot-list";

    let template = document.getElementById("template-snapshot-list");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".list-title").textContent = snapshotTitle;

    this.appendChild(fragment);
  }

  updateContents(nodes) {
    this.querySelector(".snapshots-panel").replaceChildren(...nodes);
    this.hidden = !nodes.length;
  }
}

export class SuggestedSnapshotList extends SnapshotList {
  constructor(snapshotTitle = "Suggested") {
    super(snapshotTitle);
    this.recommendations = window.CompanionUtils.initialRecommendationData();
  }

  handleEvent({ type, detail }) {
    switch (type) {
      case "Companion:SnapshotsChanged": {
        let { recommendations } = detail;
        this.recommendations = recommendations;
        this.updateRecommendations(
          this.recommendations.slice(0, MAX_SNAPSHOTS)
        );
        noteTelemetryTimestamp("Companion:SuggestedSnapshotsPainted", {
          numberOfSnapshots: this.recommendations.length,
        });
        break;
      }
    }
  }

  connectedCallback() {
    window.addEventListener("Companion:SnapshotsChanged", this);
    this.updateRecommendations(this.recommendations.slice(0, MAX_SNAPSHOTS));
    // This should generally be false. However, in case anything changes in the
    // future and we're able to get snapshots by the time of connectedCallback,
    // we want to be able to see it in our telemetry.
    if (this.recommendations.length) {
      noteTelemetryTimestamp("Companion:SuggestedSnapshotsPainted", {
        numberOfSnapshots: this.recommendations.length,
      });
    }
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:SnapshotsChanged", this);
  }

  updateRecommendations(recommendations) {
    let nodes = [];
    for (let {
      faviconSelector,
      source,
      score,
      snapshot,
      preview,
    } of recommendations) {
      snapshot.image = preview;
      snapshot.faviconSelector = faviconSelector;
      nodes.push(new Recommendation(snapshot, source, score));
    }

    this.updateContents(nodes);
  }
}

export class RecentlyClosedSnapshotList extends SnapshotList {
  constructor(snapshotTitle = "Recently Closed") {
    super(snapshotTitle);
  }

  async connectedCallback() {
    // TODO: H&M to populate with recently closed river contents
    let recentlyClosedSnapshots = [];
    this.updateContents(recentlyClosedSnapshots);
  }
}

customElements.define("e-snapshot", Snapshot);
customElements.define("e-recommendation", Recommendation);
customElements.define("suggested-snapshot-list", SuggestedSnapshotList);
customElements.define("recent-snapshot-list", RecentlyClosedSnapshotList);
