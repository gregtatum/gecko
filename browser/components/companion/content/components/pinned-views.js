/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html } from "chrome://browser/content/companion/lit.all.js";
import ActiveViewManager from "chrome://browser/content/companion/components/active-view-manager.js";

class PinnedViews extends MozLitElement {
  #dragOverElement;

  static get properties() {
    return {
      viewGroups: { type: Array, state: true, attribute: false },
      activeView: { type: Object },
      dragging: { type: Boolean },
    };
  }

  constructor() {
    super();
    this.viewGroups = [];
    this.activeView = null;
    this.dragging = false;
    this.#dragOverElement = null;
  }

  isEmpty() {
    return !this.viewGroups.length;
  }

  hasView(view) {
    return this.viewGroups.some(group => group.includes(view));
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
        ?hidden=${!this.viewGroups.length && !this.dragging}
        ?hasviews=${this.viewGroups.length}
        ?dragging=${this.dragging}
        @dragover=${this.#onDragOver}
        @dragleave=${this.#onDragLeave}
        @drop=${this.#onDrop}
      >
        <img id="pin-icon" src="chrome://browser/skin/pin-12.svg"></img>
        ${this.viewGroups.map(
          viewGroup =>
            html`
              <view-group
                tabindex="0"
                exportparts="domain, history"
                ?active=${viewGroup.includes(this.activeView)}
                .viewGroup=${viewGroup}
                .activeView=${this.activeView}
                ?app=${viewGroup.isApp}
              ></view-group>
            `
        )}
      </div>
    `;
  }
}
customElements.define("pinned-views", PinnedViews);
