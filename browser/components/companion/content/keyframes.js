/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { KeyframeList, onLoad, getPlacesData } from "./shared.js";

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
    let cutoff = document.getElementById("range").valueAsNumber;

    let filterFrame = frame => {
      return frame.totalEngagement >= cutoff || frame.type == "manual";
    };

    this.displayFrames(this.frames.filter(filterFrame));
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

function filterChangeTrigger(element, event = "input") {
  element.addEventListener(event, notifyFilterListeners);
}

onFilterChange(() => {
  let cutoff = document.getElementById("range").valueAsNumber;
  document.getElementById("cutoff").textContent = `${cutoff / 1000} seconds`;
});

onLoad(() => {
  notifyFilterListeners();
  filterChangeTrigger(document.getElementById("range"));
});
