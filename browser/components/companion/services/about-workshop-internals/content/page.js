/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { LitElement } from "./lit_glue.js";

/**
 * Common page stuff.  This is being migrated from attaching to existing static
 * DOM nodes to instead be using custom-elements via lit-element.  It's likely
 * this could be made slightly more idiomatic.
 */
export class Page extends LitElement {
  constructor({ workshopAPI, router }, { title, pageId }) {
    super();

    this.router = router;
    this.pageTitle = title;
    this.pageId = pageId;

    // In the future this might allow some level of currying/tracking of
    // resources to help enable auto-cleanup, but for now this is just a way to
    // have the global available without creating a bunch of extra imports of
    // a really ugly URL.
    this.workshopAPI = workshopAPI;
  }

  setTitle(title) {
    this.pageTitle = title;
    this.router.pageHasNewTitle(this, title);
  }
}
