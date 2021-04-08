/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { openUrl } from "./shared.js";

const NUM_POCKET_STORIES = 3;

const POCKET_IMG_URL =
  "https://img-getpocket.cdn.mozilla.net/158x96/filters:format(jpeg):quality(60):no_upscale():strip_exif()/";

export class PocketStory extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;

    this.className = "pocket card";

    let template = document.getElementById("template-pocket-story");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".title").textContent = this.data.title;

    fragment
      .querySelector(".preview")
      .setAttribute("src", POCKET_IMG_URL + encodeURI(this.data.raw_image_src));
    fragment.querySelector(".excerpt").textContent = this.data.excerpt;
    fragment.querySelector(".domain").textContent = this.data.domain;

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  handleEvent() {
    openUrl(this.data.url);
  }
}

customElements.define("e-pocketstory", PocketStory);

export class PocketList extends HTMLElement {
  constructor() {
    super();

    let template = document.getElementById("template-pocket-list");
    let fragment = template.content.cloneNode(true);
    fragment.querySelector(".list-title").textContent = "Interesting Reads";
    fragment.querySelector(".list-subtitle").textContent = "Powered by Pocket";
    let shadow = this.attachShadow({ mode: "open" });
    shadow.appendChild(fragment);
  }

  async connectedCallback() {
    let key = Services.prefs.getCharPref("extensions.pocket.oAuthConsumerKey");

    let target = new URL(
      `https://getpocket.cdn.mozilla.net/v3/firefox/global-recs?version=3&consumer_key=${key}`
    );

    let response = await fetch(target);

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    let results = await response.json();
    let recommendations = results.recommendations;
    let usedIndices = new Set();

    for (let i = 0; i < NUM_POCKET_STORIES; i++) {
      let index = Math.floor(
        Math.random() * Math.floor(recommendations.length)
      );
      if (usedIndices.has(index)) {
        i--;
        continue;
      } else {
        usedIndices.add(index);
      }
      this.appendChild(
        new PocketStory({
          url: recommendations[index].url,
          domain: recommendations[index].domain,
          title: recommendations[index].title,
          excerpt: recommendations[index].excerpt,
          raw_image_src: recommendations[index].raw_image_src,
        })
      );
    }
  }
}
customElements.define("e-pocketlist", PocketList);
