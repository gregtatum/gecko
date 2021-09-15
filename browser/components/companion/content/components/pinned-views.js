/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html } from "chrome://browser/content/companion/lit.all.js";
import ActiveViewManager from "chrome://browser/content/companion/components/active-view-manager.js";

class PinnedViews extends MozLitElement {
  static get properties() {
    return {
      _views: { type: Array, state: true },
      activeView: { type: Object },
      dragging: { type: Boolean },
    };
  }

  constructor() {
    super();
    this._views = [];
    this.activeView = null;
    this.dragging = false;
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

  clear() {
    this._views = [];
  }

  #onDragOver(event) {
    event.preventDefault();
  }

  #onDrop(event) {
    event.preventDefault();
    let dt = event.dataTransfer;
    let droppedViewGroup = dt.mozGetDataAt(
      ActiveViewManager.VIEWGROUP_DROP_TYPE,
      0
    );

    // It's possible to drag a ViewGroup that is not active, so in that
    // case, we'll just assume we're dragging the last View in the group.
    let view = droppedViewGroup.activeView || droppedViewGroup.lastView;

    if (view && !view.pinned) {
      let e = new CustomEvent("UserAction:PinView", {
        bubbles: true,
        composed: true,
        detail: { view },
      });
      this.dispatchEvent(e);
    }
  }

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/components/pinned-views.css"
        type="text/css"
      />
      <div
        id="pinned-views"
        ?hidden=${!this._views.length && !this.dragging}
        ?hasviews=${this._views.length}
        ?dragging=${this.dragging}
        @dragover=${this.#onDragOver}
        @drop=${this.#onDrop}
      >
        <img id="pin-icon" src="chrome://browser/skin/pin-12.svg"></img>
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
