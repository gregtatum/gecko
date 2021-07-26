/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { html } from "chrome://browser/content/companion/lit.all.js";

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

export default class River extends MozLitElement {
  #views;
  #overflowButton;

  static get properties() {
    return {
      _displayedViewGroups: { type: Array, state: true },
      overflowedViews: { type: Array, attribute: false },
      activeView: { type: Object },
    };
  }

  constructor() {
    super();
    this.#views = [];
    // The Views that are being displayed in the River, and not overflowed.
    this._displayedViewGroups = [];
    // The Views that will be listed in the overflow menu.
    this.overflowedViews = [];
  }

  hasView(view) {
    return this.#views.includes(view);
  }

  addView(view) {
    if (!view) {
      return;
    }

    this.#views.push(view);
    this.#groupViews();
  }

  addViews(views) {
    if (!views.length) {
      return;
    }

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
    let currentPrincipal = Services.scriptSecurityManager.createContentPrincipal(
      lastView.url,
      {}
    );
    let currentGroup = [lastView];
    let index = this.#views.length - 2;

    // The idea is to work backwards through the list until one of two things
    // happens:
    //
    // 1. We run out of items.
    // 2. The number of groups reaches TOP_RIVER_GROUPS.
    for (; index >= 0; --index) {
      let view = this.#views[index];
      if (
        currentPrincipal.isSameOrigin(
          view.url,
          window.browsingContext.usePrivateBrowsing
        )
      ) {
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
        currentPrincipal = Services.scriptSecurityManager.createContentPrincipal(
          view.url,
          {}
        );
      }
    }

    if (index >= 0) {
      // We bailed out because we reached our maximum number of groups.
      // Any remaining items in the Views from index 0 to index should
      // go into the overflow menu.
      this.overflowedViews = [...this.#views.slice(0, index + 1)];
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

  render() {
    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/components/river.css"
        type="text/css"
      />
      <div id="river" ?hidden=${!this._displayedViewGroups.length}>
        ${this._displayedViewGroups.map(
          viewGroup =>
            html`
              <view-group
                exportparts="domain, history"
                ?active=${viewGroup.includes(this.activeView)}
                .views=${viewGroup}
                .activeView=${this.activeView}
              ></view-group>
            `
        )}
      </div>
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
