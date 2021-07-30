/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const { shortURL } = ChromeUtils.import(
  "resource://activity-stream/lib/ShortURL.jsm"
);

const MAX_SNAPSHOTS = 5;

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

export const dateFormat = new Intl.DateTimeFormat([], {
  dateStyle: "short",
});

function timeSince(date) {
  let DAY_IN_MS = 1000 * 60 * 60 * 24;
  let seconds = Math.floor((new Date() - date) / 1000);
  let minutes = Math.floor(seconds / 60);

  if (minutes <= 0) {
    return "now";
  }
  let hours = Math.floor(minutes / 60);
  if (hours <= 0) {
    return minutes + "m ago";
  }

  let today = new Date();
  today.setHours(0, 0, 0, 0);

  // Take the day into account when we handle hours, if
  // something happened 6 hours ago but its 3AM, it happened
  // yesterday. This doesnt happen with minutes.
  if (hours < 24 && date > today) {
    return hours + "hr ago";
  }

  let midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);

  // Once we are measuring days we only care about what day it
  // is not the time that it occured (2 days ago is the whole
  // of the day)
  let daysDiff = today - midnight;
  let days = Math.floor(daysDiff / DAY_IN_MS);

  if (days == 1) {
    return "yesterday";
  }

  let weeks = Math.floor(days / 7);

  if (weeks <= 0) {
    return days + " days ago";
  }

  return weeks + " week" + (weeks == 1 ? "" : "s") + " ago";
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
  constructor(data) {
    super();
    this.data = data;
    this.className = "snapshot card";

    let template = document.getElementById("template-snapshot");
    let fragment = template.content.cloneNode(true);

    let url = new URL(this.data.url);
    let titleEl = fragment.querySelector(".title");
    titleEl.textContent = this.data.title || url.href;

    let siteTitleEl = fragment.querySelector(".snapshot-sitetitle");
    siteTitleEl.textContent = shortURL({ url });

    let dateEl = fragment.querySelector(".snapshot-date");
    dateEl.textContent = timeSince(this.data.lastInteractionAt);

    // TODO: MR2-344: Fetch site image preview and display it in
    // .snapshot-favicon > img.

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  handleEvent() {
    window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
      url: this.data.url,
    });
  }
}

export class SnapshotList extends HidableElement {
  constructor() {
    super();
    this.className = "snapshot-list";

    let template = document.getElementById("template-snapshot-list");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".list-title").textContent = "Suggested Snapshots";

    this.appendChild(fragment);

    this.dbListener = () => this.updateSnapshots();
  }

  async connectedCallback() {
    window.addEventListener("Companion:SnapshotsChanged", this.dbListener);
    await this.updateSnapshots();
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:SnapshotsChanged", this.dbListener);
  }

  async updateSnapshots() {
    let snapshots = window.CompanionUtils.snapshots.slice(0, MAX_SNAPSHOTS);
    let panel = document.getElementById("snapshots-panel");
    let nodes = [];
    this.hidden = !snapshots.length;
    for (let snapshot of snapshots) {
      nodes.push(new Snapshot(snapshot));
    }

    panel.replaceChildren(...nodes);
  }
}

customElements.define("e-snapshot", Snapshot);
customElements.define("e-snapshot-list", SnapshotList);
