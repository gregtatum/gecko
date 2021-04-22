/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { getPlacesData, openUrl } from "./shared.js";
import { getUnreadCountAtom } from "./email.js";

const { shortURL } = ChromeUtils.import(
  "resource://activity-stream/lib/ShortURL.jsm"
);

const { PlacesUtils } = ChromeUtils.import(
  "resource://gre/modules/PlacesUtils.jsm"
);

const NavHistory = Cc["@mozilla.org/browser/nav-history-service;1"].getService(
  Ci.nsINavHistoryService
);

const NUM_TOPSITES = 4;

export class TopSite extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;

    this.className = "topsite card";

    let template = document.getElementById("template-topsite");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".title").textContent = this.data.title;
    fragment
      .querySelector(".topsite-favicon img")
      .setAttribute("src", this.data.icon);
    if (this.data.badge) {
      fragment.querySelector(
        ".topsite-favicon .badge"
      ).textContent = this.data.badge;
      fragment.querySelector(".topsite-favicon .badge").hidden = false;
    }
    if (this.data.id) {
      this.id = this.data.id;
    }

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
    this.className = "topsites";
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
              title: shortURL({ url: uri.spec }),
              icon: placesData.icon,
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
    // Add gmail
    this.appendChild(
      new TopSite({
        url: "https://mail.google.com",
        title: "gmail",
        icon: "chrome://browser/content/companion/email.svg",
        badge: await getUnreadCountAtom(),
        id: "gmail",
      })
    );
  }
}

customElements.define("e-topsites", TopSites);
