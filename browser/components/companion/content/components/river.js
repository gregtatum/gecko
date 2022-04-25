/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import { css, html } from "chrome://browser/content/companion/lit.all.js";
import ActiveViewManager from "chrome://browser/content/companion/components/active-view-manager.js";
import ViewGroupElement from "chrome://browser/content/companion/components/view-group-element.js";

export default class River extends MozLitElement {
  #views;

  static get properties() {
    return {
      viewGroups: { type: Array, attribute: false, state: true },
      overflowedViews: { type: Array, attribute: false },
      activeView: { type: Object, attribute: false },
    };
  }

  static get queries() {
    return {
      overflowButton: "#river-overflow-button",
    };
  }

  static get styles() {
    return css`
      @import url("chrome://browser/content/companion/components/river.css");
    `;
  }

  constructor() {
    super();
    // The Views that are being displayed in the River, and not overflowed.
    this.viewGroups = [];
    // The Views that will be listed in the overflow menu.
    this.overflowedViews = [];
    this.addEventListener("dragover", this.#onDragOver);
    this.addEventListener("drop", this.#onDrop);
    this.addEventListener("keyup", this.#onKeyUp);
  }

  isEmpty() {
    return !this.viewGroups.length;
  }

  hasView(view) {
    return (
      this.overflowedViews.includes(view) ||
      this.viewGroups.some(group => group.includes(view))
    );
  }

  #onKeyUp(event) {
    if (
      event.composedTarget == this.overflowButton &&
      event.keyCode == KeyEvent.DOM_VK_SPACE
    ) {
      this.#openOverflowMenu();
    } else if (
      event.composedTarget instanceof ViewGroupElement &&
      (event.keyCode == KeyEvent.DOM_VK_LEFT ||
        event.keyCode == KeyEvent.DOM_VK_RIGHT)
    ) {
      let viewGroup = event.composedTarget;
      let sibling;
      if (event.keyCode == KeyEvent.DOM_VK_LEFT) {
        if (document.dir == "ltr") {
          sibling = viewGroup.previousElementSibling;
        } else {
          sibling = viewGroup.nextElementSibling;
        }
      } else if (event.keyCode == KeyEvent.DOM_VK_RIGHT) {
        if (document.dir == "ltr") {
          sibling = viewGroup.nextElementSibling;
        } else {
          sibling = viewGroup.previousElementSibling;
        }
      }

      if (sibling) {
        sibling.focus();
      }
    }
  }

  #openOverflowMenu(event) {
    let e = new CustomEvent("UserAction:OpenOverflowPanel", {
      bubbles: true,
      composed: true,
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

  render() {
    let containsActive = this.hasView(this.activeView);
    // The base case is that the _displayedViewGroups is empty. In that case,
    // we still want the River <div> to render in order to take the appropriate
    // amount of vertical space in the toolbar - it just doesn't have any
    // contents.
    let river = [...this.viewGroups];
    // If there's a topViewGroup, we need to wrap it in a new Array in order for
    // LitElement to know to re-render the ViewGroup.
    let topViewGroup =
      containsActive && this.viewGroups.length ? river.pop() : null;
    return html`
      <toolbarbutton
        part="overflow"
        class="subviewbutton"
        id="river-overflow-button"
        tabindex="0"
        @click=${this.#openOverflowMenu}
        data-l10n-id="active-view-manager-overflow-button-text"
        data-l10n-args='{ "count": ${this.overflowedViews.length} }'
        ?hidden=${!this.overflowedViews.length}
      ></toolbarbutton>
      <div
        id="river"
        ?hidden=${!river.length}
        ?containsActive=${containsActive}
      >
        <div
          class="view-groups-wrapper"
          ?topisactive=${topViewGroup?.includes(this.activeView)}
        >
          ${river.map(
            viewGroup =>
              html`
                <view-group
                  exportparts="domain, history"
                  tabindex="0"
                  ?active=${viewGroup.includes(this.activeView)}
                  .viewGroup=${viewGroup}
                  .activeView=${this.activeView}
                ></view-group>
              `
          )}
          <view-group
            ?hidden=${!topViewGroup}
            top="true"
            tabindex="0"
            exportparts="domain, history"
            ?active=${topViewGroup && topViewGroup.includes(this.activeView)}
            .viewGroup=${topViewGroup || null}
            .activeView=${this.activeView}
          ></view-group>
        </div>
      </div>
    `;
  }
}

customElements.define("river-el", River);
