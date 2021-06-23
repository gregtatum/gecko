/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class HackyHashRouter {
  constructor(config) {
    this.config = config;
    this.curPageParams = null;
    this.curPage = null;
    this.curSegments = null;

    window.addEventListener("hashchange", () => {
      this.updateFromHash();
    });
  }

  navigateTo(segments) {
    const hash = `#/${segments.join("/")}`;
    // history.pushState is currently being weird on providing the hash with a
    // useless NS_ERROR_FAILURE, probably because of complexities related to the
    // about URL, so we'll just directly manipulate the hash.
    console.log("navigating to", hash);
    window.location.hash = hash;
  }

  navigateRelative(addSegments) {
    if (!this.curSegments) {
      return;
    }
    this.navigateTo(this.curSegments.concat(addSegments));
  }

  updateFromHash() {
    const readHash = window.location.hash.substring(1);
    let hash = readHash;
    const pieces = hash.split("/");
    console.log("ROUTER: processing", hash, pieces);

    const nextPageParams = {};
    const nextSegments = [];

    let nextPage = this.config.root;
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
          nextPageParams[nextPage.valueName] = nextPage.valueParser(rawValue);
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
        this.curPage?.constructor,
        nextPage.pageConstructor
      );
      return;
    }

    // We're changing pages, cleanup the old page if relevant.
    if (this.curPage) {
      const oldPageElem = document.getElementById(this.curPage.pageId);
      this.curPage.cleanup(oldPageElem);
      oldPageElem.classList.remove("selected");
    }

    this.curSegments = nextSegments;
    this.curPageParams = nextPageParams;
    this.curPage = new nextPage.pageConstructor(
      { router: this, workshopAPI: this.config.workshopAPI },
      nextPageParams
    );
    const nextPageElem = document.getElementById(this.curPage.pageId);
    nextPageElem.classList.add("selected");
    this.curPage.render(nextPageElem);
  }
}
