/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { openUrl } from "./shared.js";

const NUM_POCKET_STORIES = 5;

export class PocketStory extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;

    this.className = "pocket card";
    this.setAttribute("url", this.data.url);

    let template = document.getElementById("template-pocket-story");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".title").textContent = this.data.title;
    fragment.querySelector(".preview").setAttribute("src", this.data.image_src);
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
    fragment.querySelector(".list-title").textContent = "Pocket";
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
          image_src: recommendations[index].image_src,
        })
      );
    }
  }
}
customElements.define("e-pocketlist", PocketList);
