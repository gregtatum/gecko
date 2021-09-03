/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html } from "chrome://browser/content/companion/lit.all.js";

class PinnedViews extends MozLitElement {
  static get properties() {
    return {
      _views: { type: Array, state: true },
      activeView: { type: Object },
    };
  }

  constructor() {
    super();
    this._views = [];
    this.activeView = null;
  }

  addView(view) {
    this._views = [...this._views, view];
  }

  removeView(view) {
    let index = this._views.indexOf(view);
    if (index != -1) {
      this._views.splice(index, 1);
      this._views = [...this._views];
    }
  }

  hasView(view) {
    return this._views.includes(view);
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/components/pinned-views.css"
        type="text/css"
      />
      <div id="pinned-views" ?hidden=${!this._views.length}>
        ${this._views.map(
          view =>
            html`
              <view-group
                exportparts="domain, history"
                ?active=${view == this.activeView}
                .views=${[view]}
                .activeView=${this.activeView}
              ></view-group>
            `
        )}
      </div>
    `;
  }
}
customElements.define("pinned-views", PinnedViews);
