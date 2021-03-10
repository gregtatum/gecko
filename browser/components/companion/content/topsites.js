/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { KeyframeList, getPlacesData } from "./shared.js";

const { PlacesUtils } = ChromeUtils.import(
  "resource://gre/modules/PlacesUtils.jsm"
);

const NavHistory = Cc["@mozilla.org/browser/nav-history-service;1"].getService(
  Ci.nsINavHistoryService
);

const NUM_TOPSITES = 5;

export class TopSites extends KeyframeList {
  constructor() {
    super("Top Sites");
  }

  async connectedCallback() {
    super.connectedCallback();

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
      let frames = [];
      let domains = new Set();

      for (let i = 0; i < results.root.childCount; ++i) {
        let childNode = results.root.getChild(i);
        if (childNode.type == childNode.RESULT_TYPE_URI && childNode.title) {
          let frame = {};
          let uri = Services.io.newURI(childNode.uri);
          if (domains.has(uri.host)) {
            continue;
          }
          let placesData = await getPlacesData(childNode.uri);
          if (!placesData) {
            continue;
          }
          domains.add(uri.host);
          frame.url = childNode.uri;
          frame.lastVisit = childNode.time / 1000;
          frames.push({
            ...frame,
            ...placesData,
          });
        }
        if (frames.length == NUM_TOPSITES) {
          break;
        }
      }

      this.displayFrames(frames);
    } finally {
      results.root.containerOpen = false;
    }
  }
}

customElements.define("e-topsites", TopSites);
