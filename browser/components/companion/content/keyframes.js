/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { KeyframeList, onLoad, getPlacesData } from "./shared.js";
import { Range } from "./range.js";

const { Keyframes } = ChromeUtils.import("resource:///modules/Keyframes.jsm");

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
  constructor(title, minTime, maxTime, type) {
    super(title);
    this.minTime = minTime;
    this.maxTime = maxTime;
    this.type = type;
    this.frames = [];

    this.dbListener = () => this.updateFrames();
    this.filterListener = () => this.filterFrames();
  }

  async connectedCallback() {
    this.updateFrames();

    Services.obs.addObserver(this.dbListener, "keyframe-update");
    onFilterChange(this.filterListener);
  }

  disconnectedCallback() {
    offFilterChange(this.filterListener);
    Services.obs.removeObserver(this.dbListener, "keyframe-update");
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
    let dbFrames = await this.listFrames();

    let frames = [];

    for (let dbFrame of dbFrames) {
      let data = await getPlacesData(dbFrame.url);
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
    return Keyframes.query(
      this.minTime.getTime(),
      this.maxTime?.getTime(),
      this.type
    );
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
let threshold = new Range("threshold", "Threshold", 0, 100, 1, 100);

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

onLoad(() => {
  for (let scorer of scorers) {
    addRange(scorer);
  }
  document.getElementById("sliders").appendChild(threshold);

  threshold.addEventListener("input", notifyFilterListeners);

  notifyFilterListeners();
});
