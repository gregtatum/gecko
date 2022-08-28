/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this

 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html, repeat, LitElement } from "../lit_glue.js";

/**
 * Dynamically renders and updates the contents of the provided
 * `WindowedListView` or `EntireListView` instance when provided with a
 * custom element constructor that obeys the following contract:
 * - The constructor takes an argument which is the Workshop Object to be
 *   rendered.
 * - The custom element exposes an `update` method.  This will be invoked after
 *   inserting the element into the DOM.
 */
export class ListView extends LitElement {
  static get properties() {
    return {
      listView: { type: Object },
      factory: { type: Object },
      serial: { state: true },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
    `;
  }

  constructor() {
    super();
    this.serial = 0;
    this.listeningTo = null;
  }

  maybeListen() {
    if (this.listView) {
      if (this.listView.viewKind === "entire") {
        this.listView.on("complete", this, this.onListViewUpdated);
      } else {
        // Ask for a thousand of whatever there is.  The goal here is to act like
        // we're dealing with an EntireListView because we're expecting a number
        // of results that's less than a thousand.  In the event we're wrong,
        // a thousand is still sufficiently overwhelming for humans without
        // being completely overwhelming to the browser.
        this.listView.seekToTop(10, 990);
        this.listView.on("seeked", this, this.onListViewUpdated);
      }
      this.listeningTo = this.listView;
    }
  }

  maybeStopListening() {
    if (this.listeningTo) {
      if (this.listeningTo.viewKind === "entire") {
        this.listeningTo.removeListener(
          "complete",
          this,
          this.onListViewUpdated
        );
      } else {
        this.listeningTo.removeListener("seeked", this, this.onListViewUpdated);
      }
      this.listeningTo = null;
    }
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("listView")) {
      // this.listView will have the new value already, which is why we saved
      // off `listView` into `listeningTo`.
      this.maybeStopListening();
      this.maybeListen();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.maybeListen();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.maybeStopListening();
  }

  onListViewUpdated() {
    this.serial = this.listView.serial;
  }

  render() {
    if (!this.listView) {
      return html`
        <div></div>
      `;
    }

    return html`
      <div>
        ${repeat(
          this.listView.items,
          (item, index) => item?.id || `placeholder-${index}`,
          item => {
            // Null items correspond to placeholders while the data loads.
            if (!item) {
              return html`
                <div></div>
              `;
            }
            return this.factory(item);
          }
        )}
      </div>
    `;
  }
}
customElements.define("awi-list-view", ListView);
