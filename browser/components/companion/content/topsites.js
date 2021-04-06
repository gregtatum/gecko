/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { timeFormat, getPlacesData, openUrl } from "./shared.js";

const { PlacesUtils } = ChromeUtils.import(
  "resource://gre/modules/PlacesUtils.jsm"
);

const NavHistory = Cc["@mozilla.org/browser/nav-history-service;1"].getService(
  Ci.nsINavHistoryService
);

const NUM_TOPSITES = 5;

export class TopSite extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;

    this.className = "topsite card";

    let template = document.getElementById("template-topsite");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".title").textContent = this.data.title;
    fragment.querySelector(".favicon").setAttribute("src", this.data.icon);
    fragment.querySelector(".last-access").textContent = timeFormat.format(
      this.data.lastVisit
    );

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  handleEvent() {
    openUrl(this.data.url);
  }
}

customElements.define("e-topsite", TopSite);

export class TopSites extends HTMLElement {
  constructor() {
    super();

    let template = document.getElementById("template-keyframe-list");
    let fragment = template.content.cloneNode(true);
    fragment.querySelector(".list-title").textContent = "Top Sites";
    let shadow = this.attachShadow({ mode: "open" });
    shadow.appendChild(fragment);
  }

  async connectedCallback() {
    let query = NavHistory.getNewQuery();
    // Two days of history
    query.beginTime = PlacesUtils.toPRTime(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    );
    query.endTime == null;

    let queryOptions = NavHistory.getNewQueryOptions();
    queryOptions.resultType = Ci.nsINavHistoryQueryOptions.RESULTS_AS_URI;
    queryOptions.sortingMode =
      Ci.nsINavHistoryQueryOptions.SORT_BY_VISITCOUNT_DESCENDING;
    queryOptions.queryType = Ci.nsINavHistoryQueryOptions.QUERY_TYPE_HISTORY;

    let results = NavHistory.executeQuery(query, queryOptions);
    results.root.containerOpen = true;

    try {
      let domains = new Set();

      for (let i = 0; i < results.root.childCount; ++i) {
        let childNode = results.root.getChild(i);
        if (childNode.type == childNode.RESULT_TYPE_URI && childNode.title) {
          let uri = Services.io.newURI(childNode.uri);
          if (domains.has(uri.host)) {
            continue;
          }
          let placesData = await getPlacesData(childNode.uri);
          if (!placesData) {
            continue;
          }
          domains.add(uri.host);
          this.appendChild(
            new TopSite({
              url: childNode.uri,
              title: placesData.title,
              // icon: placesData.richIcon || placesData.icon,
              icon: placesData.icon,
              lastVisit: childNode.time / 1000,
            })
          );
        }
        if (this.childNodes.length == NUM_TOPSITES) {
          break;
        }
      }
    } finally {
      results.root.containerOpen = false;
    }
  }
}

customElements.define("e-topsites", TopSites);
