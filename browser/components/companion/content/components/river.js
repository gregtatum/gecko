/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import {
  html,
  repeat,
  ifDefined,
} from "chrome://browser/content/companion/lit.all.js";
import ActiveViewManager from "chrome://browser/content/companion/components/active-view-manager.js";
import ViewGroupElement from "chrome://browser/content/companion/components/view-group-element.js";

export default class River extends MozLitElement {
  #focusedChild;

  static get properties() {
    return {
      viewGroups: { type: Array, attribute: false, state: true },
      overflowedViews: { type: Array, attribute: false },
      activeView: { type: Object, attribute: false },
      keying: { type: Boolean, attribute: false, state: true },
    };
  }

  static get queries() {
    return {
      overflowButton: "#river-overflow-button",
    };
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
    this.addEventListener("focusin", this.#onFocusIn);
    this.addEventListener("focusout", this.#onFocusOut);
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
    if (event.key == "Enter" || event.key == " " || event.type == "click") {
      // PanelMultiView.jsm expects a keypress event in order to focus
      // the first item in a opened panel.
      // Without this, VoiceOver users will have no notification that
      // the Recent Views menu has been opened when using
      // the VoiceOver modifier key + Space.
      let clonedEvent = new KeyboardEvent("keypress", event);
      let e = new CustomEvent("UserAction:OpenOverflowPanel", {
        bubbles: true,
        composed: true,
        detail: { view: this.activeView, triggerEvent: clonedEvent },
      });
      this.dispatchEvent(e);
    }
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

  #onFocusIn() {
    if (
      !(Services.focus.getLastFocusMethod(window) & Services.focus.FLAG_BYMOUSE)
    ) {
      this.keying = true;
    }
  }

  #onFocusOut() {
    this.keying = false;
  }

  render() {
    let containsActive = this.hasView(this.activeView);
    // The base case is that the _displayedViewGroups is empty. In that case,
    // we still want the River <div> to render in order to take the appropriate
    // amount of vertical space in the toolbar - it just doesn't have any
    // contents.
    let topViewGroup = containsActive ? this.viewGroups.at(-1) : null;

    return html`
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/components/river.css"
      />

      <toolbarbutton
        part="overflow"
        class="subviewbutton"
        id="river-overflow-button"
        tabindex="0"
        @click=${this.#openOverflowMenu}
        @keypress=${this.#openOverflowMenu}
        data-l10n-id="active-view-manager-overflow-button"
        data-l10n-args='{ "count": ${this.overflowedViews.length} }'
        ?hidden=${!this.overflowedViews.length}
      ></toolbarbutton>
      <div id="river" ?containsActive=${containsActive} role="tablist">
        <div
          class="view-groups-wrapper"
          ?topisactive=${topViewGroup?.includes(this.activeView)}
        >
          ${repeat(
            this.viewGroups,
            viewGroup => viewGroup.id,
            (viewGroup, index) => {
              let isExpandedWithHistory = null;
              let isActive = viewGroup.includes(this.activeView);

              // We intentionally only set isExpandedWithHistory to `true` or `false`
              // if there's more than 1 View in the ViewGroup so that ifDefined knows
              // to remove the `aria-expanded` attribute if it turns out that there's
              // only a single View in the ViewGroup.
              if (viewGroup.length > 1) {
                isExpandedWithHistory = isActive;
              }

              return html`
                <view-group
                  ?top=${viewGroup === topViewGroup}
                  exportparts="domain, history, page-action-button"
                  tabindex="0"
                  role="tab"
                  aria-expanded=${ifDefined(isExpandedWithHistory)}
                  aria-label=${isActive
                    ? this.activeView.title
                    : viewGroup.lastView.title}
                  aria-selected=${isActive}
                  ?active=${isActive}
                  .viewGroup=${viewGroup}
                  .activeView=${this.activeView}
                  .keying=${this.keying}
                ></view-group>
              `;
            }
          )}
        </div>
      </div>
    `;
  }

  willUpdate() {
    this.#focusedChild = this.renderRoot.activeElement;
  }

  updated() {
    if (this.#focusedChild) {
      let focusedElement = Services.focus.focusedElement;

      // We only want to shift focus to the focusedChild if focus
      // has been set on something within it already.
      if (
        focusedElement?.containingShadowRoot != this.#focusedChild.shadowRoot
      ) {
        this.#focusedChild.focus();
      }
    }
    this.#focusedChild = null;
  }
}

customElements.define("river-el", River);
