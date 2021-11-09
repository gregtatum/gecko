/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { html, render } from "./lit_glue.js";

import "./elements/data_inspector.js";
import "./shellements/page_frame.js";

export class HackyHashRouter {
  constructor(config) {
    this.config = config;
    this.curPageParams = null;
    this.curPage = null;
    this.curSegments = null;
    this.curCrumbs = null;

    this.curInspectedWidget = html`
      <p style="padding: 1em;">Nothing to inspect yet.</p>
    `;

    this.pagesContainer = document.getElementById("pages");

    window.addEventListener("hashchange", () => {
      this.updateFromHash();
    });
  }

  navigateTo(segments, query) {
    let hash = `#/${segments.join("/")}`;
    if (query) {
      hash = `${hash}?${query}`;
    }
    // history.pushState is currently being weird on providing the hash with a
    // useless NS_ERROR_FAILURE, probably because of complexities related to the
    // about URL, so we'll just directly manipulate the hash.
    console.log("navigating to", hash);
    window.location.hash = hash;
  }

  navigateRelative(addSegments, query = null) {
    if (!this.curSegments) {
      return;
    }
    if (query) {
      query = new URLSearchParams(Object.entries(query)).toString();
    }
    this.navigateTo(this.curSegments.concat(addSegments), query);
  }

  inspect(val) {
    this.curInspectedWidget = html`
      <awi-data-inspector .data=${val} />
    `;
    this.updateRender();
  }

  async updateFromHash() {
    const readHash = window.location.hash.substring(1);
    const [hash, rawQuery] = readHash.split("?");
    const pieces = hash.split("/");

    const nextPageParams = {};
    const nextSegments = [];
    const nextCrumbPromises = [];

    const pushSegmentCrumb = (page, parsedValue) => {
      const snapshottedSegments = nextSegments.concat();
      nextCrumbPromises.push(
        (async () => {
          const label = await page.makeLabel(parsedValue);
          return {
            label,
            click: () => {
              this.navigateTo(snapshottedSegments);
            },
          };
        })()
      );
    };

    if (rawQuery) {
      nextPageParams.query = Object.fromEntries(
        new URLSearchParams(rawQuery).entries()
      );
    }

    console.log("ROUTER: processing", hash, pieces, nextPageParams.query);

    let nextPage = this.config.root;
    pushSegmentCrumb(nextPage, undefined);

    // for loop so we can consume pieces in the loop for params.
    for (let iPiece = 0; iPiece < pieces.length; iPiece++) {
      const piece = pieces[iPiece];
      // Ignore empty segments.
      if (!piece) {
        continue;
      }
      nextSegments.push(piece);

      if (nextPage.children.hasOwnProperty(piece)) {
        nextPage = nextPage.children[piece];
        if (nextPage.valueParser) {
          iPiece++;
          const rawValue = pieces[iPiece];
          nextSegments.push(rawValue);
          const parsedValue = nextPage.valueParser(rawValue);
          nextPageParams[nextPage.valueName] = parsedValue;
          pushSegmentCrumb(nextPage, parsedValue);
        } else {
          pushSegmentCrumb(nextPage, undefined);
        }
      }
    }

    // Check if we're already displaying this page and nothing should change.
    if (
      this.curPage?.constructor === nextPage.pageConstructor &&
      JSON.stringify(this.curPageParams) === JSON.stringify(nextPageParams)
    ) {
      // Nothing to do if that's what we're already displaying.
      console.log(
        "ROUTER: already on that page, not doing anything",
        this.curPage?.constructor.name,
        nextPage.pageConstructor.name
      );
      return;
    }

    this.curSegments = nextSegments;
    this.curPageParams = nextPageParams;
    this.curPage = new nextPage.pageConstructor(
      { router: this, workshopAPI: this.config.workshopAPI },
      nextPageParams
    );
    // Initially render without the crumbs present since there is a data
    // dependency on the workshop API to provide pretty labels, and that could
    // hang us below.  In the event this does end up hanging at all, we probably
    // should populate the crumbs initially with just the raw values and then
    // allow for the promises to provide a better experiences if they resolve
    // in a timely fashion.
    this.curCrumbs = [];
    this.updateRender();

    // Set the title which the page may update dynamically via `pageHasNewTitle`
    // in render (or after, if async).
    document.title = this.curPage.pageTitle;

    // Now wait for the crumbs to resolve.
    this.curCrumbs = await Promise.all(nextCrumbPromises);
    this.updateRender();
  }

  updateRender() {
    render(
      html`
        <awi-page-frame
          .crumbs=${this.curCrumbs}
          .page=${this.curPage}
          .inspected=${this.curInspectedWidget}
        />
      `,
      document.body
    );
  }

  pageHasNewTitle(page, title) {
    // This could be happening async and be moot.
    if (page === this.curPage) {
      // For now this is just for the document.title, but in the short term this
      // could be used for a built-in bread-crumbs style setup.
      document.title = title;
    }
  }
}
