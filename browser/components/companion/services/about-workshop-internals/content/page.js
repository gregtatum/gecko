/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Common page stuff.
 */
export class Page {
  constructor({ workshopAPI, router }, { pageId }) {
    this.router = router;
    this.pageId = pageId;

    // In the future this might allow some level of currying/tracking of
    // resources to help enable auto-cleanup, but for now this is just a way to
    // have the global available without creating a bunch of extra imports of
    // a really ugly URL.
    this.workshopAPI = workshopAPI;
  }

  render(pageElem) {
    // no-op
  }

  cleanup(pageElem) {
    // no-op
  }
}
