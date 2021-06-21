/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Range } from "./range.js";

const NUM_KEYFRAMES = 20;

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

export class Keyframe extends HidableElement {
  constructor(data) {
    super();
    this.data = data;

    this.className = "keyframe card";

    let template = document.getElementById("template-keyframe");
    let fragment = template.content.cloneNode(true);
    this.updateDOM(fragment);

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  updateDOM(target) {
    target.querySelector(".favicon").src = this.data.icon;
    target.querySelector(".title").textContent = this.data.title;
    target.querySelector(".title").setAttribute("title", this.data.title);
    target.querySelector(".category").textContent = this.data.category;

    this.toggleAttribute(
      "current",
      window.CompanionUtils.currentURI == this.data.url
    );

    let score = target.querySelector(".score");
    score.textContent = this.data.score.toFixed(1);
    score.setAttribute(
      "title",
      `Engagement: ${(this.data.totalEngagement / 1000).toFixed(1)}s
Typing time: ${(this.data.typingTime / 1000).toFixed(1)}s
Keypresses: ${this.data.keypresses}

Typing ratio: ${Math.round(
        (100 * this.data.typingTime) / this.data.totalEngagement
      )}%
Characters per second: ${
        this.data.keypresses == 0
          ? 0
          : Math.round(this.data.keypresses / (this.data.typingTime / 1000))
      }`
    );

    if (this.data.lastVisit) {
      target.querySelector(".last-access").textContent = timeSince(
        this.data.lastVisit
      );
    }
  }

  update(data) {
    this.data = data;
    this.updateDOM(this);
  }

  handleEvent() {
    window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
      url: this.data.url,
    });
  }
}

customElements.define("e-keyframe", Keyframe);

export class KeyframeList extends HidableElement {
  constructor(title) {
    super();

    this.title = title;
    let shadow = this.attachShadow({ mode: "open" });
    let template = document.getElementById("template-keyframe-list");
    let fragment = template.content.cloneNode(true);
    fragment.querySelector(".list-title").textContent = this.title;

    shadow.appendChild(fragment);
  }

  displayFrames(frames) {
    let elements = frames.map(frame => {
      let element = this.querySelector(
        `.keyframe[url="${CSS.escape(frame.url)}"`
      );
      if (element) {
        element.update(frame);
        return element;
      }

      return new Keyframe(frame);
    });
    this.replaceChildren(...elements.slice(0, NUM_KEYFRAMES));

    this.hidden = !elements.length;
  }
}

customElements.define("e-keyframelist", KeyframeList);

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

let filterListeners = new Set();
function onFilterChange(cb) {
  filterListeners.add(cb);
}

function offFilterChange(cb) {
  filterListeners.delete(cb);
}

function notifyFilterListeners() {
  for (let cb of filterListeners) {
    cb();
  }
}

export class KeyframeDbList extends KeyframeList {
  constructor(title, keyframeListName) {
    super(title);
    this.keyframeListName = keyframeListName;
    this.frames = [];

    this.dbListener = () => this.updateFrames();
    this.filterListener = () => this.filterFrames();
  }

  async connectedCallback() {
    this.updateFrames();

    window.addEventListener("Companion:Setup", this.dbListener);
    window.addEventListener("Companion:KeyframesChanged", this.dbListener);
    onFilterChange(this.filterListener);
  }

  disconnectedCallback() {
    offFilterChange(this.filterListener);
    window.removeEventListener("Companion:Setup", this.dbListener);
    window.removeEventListener("Companion:KeyframesChanged", this.dbListener);
  }

  filterFrames() {
    let displayFrames = [];

    for (let frame of this.frames) {
      let score = 0;

      for (let [range, apply] of ranges) {
        let change = apply(frame, range.value);
        if (!Number.isNaN(change)) {
          score += change;
        }
      }

      if (score < threshold.value) {
        continue;
      }

      displayFrames.push({
        ...frame,
        score,
      });
    }

    displayFrames.sort((a, b) => b.score - a.score);

    this.displayFrames(displayFrames);
  }

  async updateFrames() {
    let dbFrames = this.listFrames();

    let frames = [];

    for (let dbFrame of dbFrames) {
      let data = window.CompanionUtils.getPlacesData(dbFrame.url);
      if (!data) {
        continue;
      }
      if (data.previewImage) {
        data.richIcon = data.previewImage;
      }

      frames.push({
        ...dbFrame,
        ...data,
      });
    }

    this.frames = frames;
    this.filterFrames();
  }

  listFrames() {
    return window.CompanionUtils.keyframes[this.keyframeListName];
  }
}

customElements.define("e-keyframedblist", KeyframeDbList);

let scorers = [
  {
    id: "engagement",
    label: "Engagement time",
    min: 0,
    max: 10,
    step: 0.1,
    value: 3,
    apply: (frame, value) => (frame.totalEngagement / 1000) * value,
  },
  {
    id: "typing-time",
    label: "Typing time",
    min: 0,
    max: 10,
    step: 0.1,
    value: 5,
    apply: (frame, value) => (frame.typingTime / 1000) * value,
  },
  {
    id: "typing-ratio",
    label: "Typing ratio",
    min: 0,
    max: 10,
    step: 0.1,
    value: 4,
    apply: (frame, value) =>
      ((100 * frame.typingTime) / frame.totalEngagement) * value,
  },
  {
    id: "keypresses",
    label: "Keypresses",
    min: 0,
    max: 10,
    step: 0.1,
    value: 6,
    apply: (frame, value) => frame.keypresses * value,
  },
  {
    id: "cps",
    label: "Characters per second",
    min: 0,
    max: 10,
    step: 0.1,
    value: 3,
    apply: (frame, value) =>
      (frame.keypresses / (frame.typingTime / 1000)) * value,
  },
];

let ranges = new Map();
let threshold;

function addRange(scorer) {
  let range = new Range(
    scorer.id,
    scorer.label,
    scorer.min,
    scorer.max,
    scorer.step,
    scorer.value
  );
  ranges.set(range, scorer.apply);
  range.addEventListener("input", notifyFilterListeners);
  document.getElementById("sliders").appendChild(range);
}

window.addEventListener("Companion:Setup", () => {
  threshold = new Range("threshold", "Threshold", 0, 100, 1, 100);
  for (let scorer of scorers) {
    addRange(scorer);
  }

  document.getElementById("sliders").appendChild(threshold);
  threshold.addEventListener("input", notifyFilterListeners);
  notifyFilterListeners();
});
