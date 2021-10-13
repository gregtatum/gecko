/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html } from "chrome://browser/content/companion/lit.all.js";
import ActiveViewManager from "chrome://browser/content/companion/components/active-view-manager.js";

class PinnedViews extends MozLitElement {
  #dragOverElement;

  static get queries() {
    return {
      pinIcon: "#pin-icon",
    };
  }

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
    this.#dragOverElement = null;
  }

  addView(view, atIndex) {
    let index = this._views.indexOf(view);
    if (index != -1) {
      this._views.splice(index, 1);
    }

    this._views = [...this._views];
    this._views.splice(atIndex, 0, view);
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
    this.#dragOverElement = event.target;
    this.#dragOverElement.setAttribute("draggingover", "true");
  }

  #onDragLeave(event) {
    if (event.target == this.#dragOverElement) {
      this.#cancelDragActive();
    }
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
    let view = droppedViewGroup.active
      ? droppedViewGroup.activeView
      : droppedViewGroup.lastView;
    let dragOverElement = this.#dragOverElement;

    this.#cancelDragActive();

    let index = 0;
    if (dragOverElement.tagName == "view-group") {
      let dragOverView = dragOverElement.lastView;
      let dragIndex = this._views.indexOf(dragOverView);

      if (dragIndex != -1) {
        index = dragIndex + 1;
      }
    }

    if (view) {
      let e = new CustomEvent("UserAction:PinView", {
        bubbles: true,
        composed: true,
        detail: { view, index },
      });
      this.dispatchEvent(e);
    }
  }

  #cancelDragActive() {
    this.#dragOverElement.removeAttribute("draggingover");
    this.#dragOverElement = null;
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
        @dragleave=${this.#onDragLeave}
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
