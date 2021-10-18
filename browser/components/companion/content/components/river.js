/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { css, html } from "chrome://browser/content/companion/lit.all.js";
import ViewGroup from "chrome://browser/content/companion/components/view-group.js";
import ActiveViewManager from "chrome://browser/content/companion/components/active-view-manager.js";

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

export default class River extends MozLitElement {
  #views;

  static get properties() {
    return {
      _displayedViewGroups: { type: Array, state: true },
      overflowedViews: { type: Array, attribute: false },
      activeView: { type: Object },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://browser/content/companion/components/river.css");
    `;
  }

  constructor() {
    super();
    this.#views = [];
    // The Views that are being displayed in the River, and not overflowed.
    this._displayedViewGroups = [];
    // The Views that will be listed in the overflow menu.
    this.overflowedViews = [];
    this.addEventListener("dragover", this.#onDragOver);
    this.addEventListener("drop", this.#onDrop);
  }

  hasView(view) {
    return this.#views.includes(view);
  }

  addView(view) {
    if (!view) {
      return;
    }

    let index = this.#views.indexOf(view);
    if (index != -1) {
      this.#views.splice(index, 1);
    }

    this.#views.push(view);
    this.#groupViews();
  }

  setViews(views) {
    this.#views = [];
    this.addViews(views);
  }

  addViews(views) {
    if (this.#views.length) {
      this.#views = [...this.#views, ...views];
    } else {
      this.#views = [...views];
    }
    this.#groupViews();
  }

  removeView(view) {
    let index = this.#views.indexOf(view);
    this.#views.splice(index, 1);

    this.#groupViews();
  }

  #groupViews() {
    this._displayedViewGroups = [];
    this.overflowedViews = [];

    if (!this.#views.length) {
      let e = new CustomEvent("RiverRegrouped", {
        bubbles: true,
        composed: true,
        detail: { overflowCount: 0 },
      });
      this.dispatchEvent(e);
      return;
    }

    // After the list of Views in the River changes, we want to do some
    // grouping. The idea is to work backwards through the View list, and
    // group Views that are same-origin together into a single ViewGroup.
    // We do this until we reach a maximum of River.maxRiverGroups, and the
    // rest show up in the overflow menu.

    // We start with the last View in the list, and create a Principal for it
    // to do same-origin checks with other Views. We then add that View to an
    // initial group, and start the loop index at the 2nd last item in the list.
    let lastView = this.#views[this.#views.length - 1];
    let currentGroup = [lastView];
    let index = this.#views.length - 2;

    // The idea is to work backwards through the list until one of two things
    // happens:
    //
    // 1. We run out of items.
    // 2. The number of groups reaches TOP_RIVER_GROUPS.
    for (; index >= 0; --index) {
      let view = this.#views[index];
      if (ViewGroup.canGroup(currentGroup[0], view)) {
        currentGroup.push(view);
        continue;
      } else {
        // We're reversing the currentGroup because we've been _pushing_
        // them into the Array, and we're going to want to ultimately
        // represent them in reverse order. We _could_ have used unshift
        // to put each item at the start of the Array, but that's apparently
        // more expensive than doing one big reverse at the end.
        this._displayedViewGroups.push(currentGroup.reverse());

        if (this._displayedViewGroups.length >= River.maxRiverGroups) {
          break;
        }

        currentGroup = [view];
      }
    }

    if (index >= 0) {
      // We bailed out because we reached our maximum number of groups.
      // Any remaining items in the Views from index 0 to index should
      // go into the overflow menu.
      this.overflowedViews = [...this.#views.slice(0, index + 1)].reverse();
    } else {
      // We bailed out because we reached the end of the list. Whatever is
      // in currentGroup can get pushed into the displayed groups.
      //
      // See the comment inside of the loop for why we're reversing the
      // currentGroup.
      this._displayedViewGroups.push(currentGroup.reverse());
    }

    // Finally, we reverse the displayed ViewGroups that we've collected.
    // Similar to the currentGroup's, this is faster than doing an unshift
    // for each item.
    this._displayedViewGroups.reverse();

    let e = new CustomEvent("RiverRegrouped", {
      bubbles: true,
      composed: true,
      detail: { overflowCount: this.overflowedViews.length },
    });
    this.dispatchEvent(e);
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
    let view = droppedViewGroup.lastView;

    if (view && view.pinned) {
      let e = new CustomEvent("UserAction:UnpinView", {
        bubbles: true,
        composed: true,
        detail: { view },
      });
      this.dispatchEvent(e);
    }
  }

  viewUpdated() {
    this.#groupViews();
  }

  render() {
    let containsActive = this.#views.includes(this.activeView);
    // The base case is that the _displayedViewGroups is empty. In that case,
    // we still want the River <div> to render in order to take the appropriate
    // amount of vertical space in the toolbar - it just doesn't have any
    // contents.
    let riverViewGroups = [...this._displayedViewGroups];
    // If there's a topViewGroup, we need to wrap it in a new Array in order for
    // LitElement to know to re-render the ViewGroup.
    let topViewGroup =
      containsActive && this._displayedViewGroups.length
        ? [...riverViewGroups.pop()]
        : null;
    return html`
      <div
        id="river"
        ?hidden=${!riverViewGroups.length}
        ?containsActive=${containsActive}
      >
        <div class="view-groups-wrapper">
          ${riverViewGroups.map(
            viewGroup =>
              html`
                <view-group
                  exportparts="domain, history"
                  ?active=${viewGroup.includes(this.activeView)}
                  .views=${[...viewGroup]}
                  .activeView=${this.activeView}
                ></view-group>
              `
          )}
        </div>
      </div>
      <view-group
        ?hidden=${!topViewGroup}
        top="true"
        exportparts="domain, history"
        ?active=${topViewGroup && topViewGroup.includes(this.activeView)}
        .views=${topViewGroup || []}
        .activeView=${this.activeView}
      ></view-group>
    `;
  }
}

XPCOMUtils.defineLazyPreferenceGetter(
  River,
  "maxRiverGroups",
  "browser.river.maxGroups",
  5
);

customElements.define("river-el", River);
