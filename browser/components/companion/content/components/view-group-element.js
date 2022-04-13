/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import {
  css,
  html,
  classMap,
  ifDefined,
} from "chrome://browser/content/companion/lit.all.js";

import getViewSecurityState from "../siteSecurity.js";

export default class ViewGroupElement extends MozLitElement {
  #slidingWindowIndex;

  static get queries() {
    return {
      iconContainer: ".view-icon-container",
    };
  }

  static get properties() {
    return {
      viewGroup: { type: Object },
      activeView: { type: Object },
      active: { type: Boolean },
      busyAnimating: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://browser/content/companion/components/view-group-element.css");
    `;
  }

  constructor() {
    super();
    this.viewGroup = null;
    this.activeView = null;
    this.busyAnimationTimeout = null;
    this.addEventListener("click", this.#onViewGroupSelected);
    this.addEventListener("keyup", this.#onViewGroupSelected);
    this.addEventListener("auxclick", this.#onAuxClick);
    this.#slidingWindowIndex = -1;
  }

  #onViewGroupSelected(event) {
    if (
      event.type == "keyup" &&
      !(
        event.keyCode == KeyEvent.DOM_VK_RETURN ||
        event.keyCode == KeyEvent.DOM_VK_SPACE
      )
    ) {
      return;
    }

    let e = new CustomEvent("UserAction:ViewGroupSelected", {
      bubbles: true,
      composed: true,
      detail: { clickedViewGroup: this.viewGroup },
    });
    this.dispatchEvent(e);
  }

  #onAuxClick(event) {
    if (event.button != 1) {
      return;
    }

    let selectEvent = new CustomEvent("UserAction:ViewGroupSelected", {
      bubbles: true,
      composed: true,
      detail: { clickedViewGroup: this.viewGroup },
    });
    this.dispatchEvent(selectEvent);

    let closeEvent = new CustomEvent("UserAction:ViewGroupCloseOne", {
      bubbles: true,
      composed: true,
      detail: { clickedViewGroup: this.viewGroup },
    });
    this.dispatchEvent(closeEvent);
  }

  #onHistoryClick(event) {
    let view = event.target.view;
    let e = new CustomEvent("UserAction:ViewSelected", {
      bubbles: true,
      composed: true,
      detail: { clickedView: view },
    });
    this.dispatchEvent(e);
    // We don't want this to get handled by the #onViewGroupSelected handler, since
    // that will then switch to the last View in this group.
    event.stopPropagation();
  }

  #pageActionButtonClicked(event) {
    let e = new CustomEvent("UserAction:OpenPageActionMenu", {
      bubbles: true,
      composed: true,
      detail: { view: this.activeView },
    });
    this.dispatchEvent(e);
    // We don't want this to get handled by the #onViewGroupSelected handler, since
    // that will then switch to the last View in this group.
    event.stopPropagation();
  }

  /**
   * Returns the View that the majority of the ViewGroup component
   * represents.
   */
  get lastView() {
    return this.viewGroup?.lastView;
  }

  #transitionEndOrCancel() {
    let view = this.active ? this.activeView : this.lastView;
    this.busyAnimating = view?.busy ?? false;
  }

  render() {
    const DEFAULT_FAVICON = "chrome://global/skin/icons/defaultFavicon.svg";

    let iconURL = DEFAULT_FAVICON;
    let view = this.active ? this.activeView : this.lastView;

    if (!view) {
      return null;
    }

    if (view.iconURL || view.url) {
      iconURL = view.iconURL ?? `page-icon:${view.url.spec}`;
    }

    let securityIconClass = getViewSecurityState(view);

    let domain = "";
    try {
      domain = view.url.host ?? "";
    } catch (e) {}

    let history = [];
    let viewGroupHistory = this.computeHistoryVisualization(view);

    for (let { view: historyView, size } of viewGroupHistory) {
      let classes = {
        history: true,
        active: this.active && historyView == this.activeView,
      };

      history.push(
        html`
          <button
            class=${classMap(classes)}
            .view=${historyView}
            @click=${this.#onHistoryClick}
            title=${historyView.title}
            size=${size}
          ></button>
        `
      );
    }

    // If we're not active, then we want the entire ViewGroup to show
    // a tooltip when hovered showing the title of the last View.
    // If, however, we're active, then we'll have the view-title be
    // the element show the tooltip to avoid conflicting with tooltips
    // on any history "breadcrumbs".
    let rootTitle = this.active ? undefined : view.title;

    // So, this is a bit annoying. This is basically a battery usage
    // optimization. When we change the `busy` attribute to false, the opacity
    // of the spinner will transition to 0. We need to give it time to do that,
    // and we want to continue spinning while it does so. However, if we
    // continue spinning indefinitely, then even though nothing will be
    // visible to the user, we'll still generate frames on the compositor and
    // eat up battery life, which is A Bad Thing. So we add a listener to
    // transitionend on the spinner and check inside it if we're busy or not,
    // in order to re-update the attribute.
    if (view.busy && !this.busyAnimating) {
      this.busyAnimating = true;
    }

    // We expose the history / domain parts of a ViewGroup so that consumers
    // can choose to hide the domain and show the history breadcrumbs when
    // hovering the toolbar. We only need to show breadcrumbs if there's more
    // than one view in the group.
    let shouldExposeParts = this.viewGroup.length > 1;

    return html`
      <div class="view-el" title=${ifDefined(rootTitle)} ?busy=${
      view.busy
    } ?pause-animation=${!this.busyAnimating}>
        <div class="view-icon-overlay"></div>
        <div class="view-loading-spinner-container" @transitionend=${
          this.#transitionEndOrCancel
        } @transitioncancel=${this.#transitionEndOrCancel}>
          <img class="view-loading-spinner" src="chrome://browser/content/companion/viewLoading.svg"></img>
        </div>
        <span class="view-icon-container" part="icon-container">
          <img class="view-icon" src=${iconURL}></img>
        </span>
        <div class="view-label-container" part="label-container">
          <div class="view-title"
               part="title"
               title=${view.title}>${view.title}</div>
          <div class="view-domain-container" part=${
            shouldExposeParts ? "domain" : ""
          }>
            <div id="view-security-icon" class="${securityIconClass}"></div>
            <div class="view-domain">${domain}</div>
          </div>
          <div class="view-history" part=${
            shouldExposeParts ? "history" : ""
          }>${history}</div>
        </div>
        <button class="page-action-button" ?hidden=${!this.active}
                @click="${this.#pageActionButtonClicked}"
                data-l10n-id="page-action-menu-button"
        ></button>
      </div>
    `;
  }

  /**
   * Determines whether or not two Views should be put into the same
   * ViewGroup.
   *
   * Views can be grouped if they are same origin AND their favicons
   * match (or one of their favicons are null). This heuristic allows
   * us to keep most same-origin navigations grouped, but lets us have
   * group separation for sites that have multiple "apps" hosted under
   * the same origin - for example, docs.google.com is where both
   * Google Docs, Google Spreadsheets and Google Presentatations can be
   * found. However Google makes their favicons distinct, which means
   * we correctly skip grouping them together.
   *
   * @param {View} viewA
   *   The View to check for grouping with viewB
   * @param {View} viewB
   *   The View to check for grouping with viewA
   * @returns {boolean} True if the two Views can be grouped.
   */
  static canGroup(viewA, viewB) {
    let isSameOrigin = viewA.contentPrincipal.isSameOrigin(
      viewB.url,
      window.browsingContext.usePrivateBrowsing
    );

    // If either of the View icons are null, we'll still let them group
    // if they're same origin. We'll have a chance to reconsider the grouping
    // once the favicon finishes loading.
    return (
      isSameOrigin &&
      (viewA.iconURL == viewB.iconURL ||
        viewA.iconURL == null ||
        viewB.iconURL == null)
    );
  }

  /**
   * @typedef {object} ViewGroupHistory
   *   An object that contains information to render a single history
   *   button within the ViewGroup.
   * @property {View} view
   *   The View being represented by the button.
   * @property {String} size
   *   The size that the button should be.
   */

  /**
   * Returns an array of ViewGroupHistory items that can then be
   * used to show a visualization of history within the ViewGroup.
   *
   * Note that this function is stateful, as it stashes the array
   * index of the sliding window it has computed around the selected
   * view, since that will influence the visualization of history
   * if the selected view changes.
   *
   * @param {View} view
   *   The selected view.
   * @returns {ViewGroupHistory[]}
   */
  computeHistoryVisualization(view) {
    if (!view || !this.viewGroup.length) {
      return [];
    }

    let selectedViewIndex = this.viewGroup.indexOf(view);

    if (this.#slidingWindowIndex == -1) {
      // We've never set a sliding window for this ViewGroup,
      // so create a new one based on where view is in the views
      // array.
      this.#slidingWindowIndex = ViewGroupElement.#findSlidingWindowIndexCenteredAt(
        this.viewGroup.length,
        selectedViewIndex
      );
    } else if (selectedViewIndex < this.#slidingWindowIndex) {
      // We have a pre-existing sliding window, and we need to figure
      // out where to slide it. Let's deal with the harder cases first:
      //
      // Case 1: The view is before the sliding window.
      //
      // We slide the sliding window index so that it's offset by
      // -1 from the selected view index, or just 0 if the selected
      // index is 0.
      this.#slidingWindowIndex = Math.max(0, selectedViewIndex - 1);
    } else if (
      selectedViewIndex >
      this.#slidingWindowIndex + ViewGroupElement.SLIDING_WINDOW_WIDTH - 1
    ) {
      // Case 2: The view is after the sliding window.
      //
      // We slide the sliding window index so that it's offset from
      // the selectedViewIndex by the SLIDING_WINDOW_PADDING, or to
      // just the SLIDING_WINDOW_WIDTH at the end of the views array -
      // whichever is smaller.
      this.#slidingWindowIndex = Math.min(
        this.viewGroup.length - ViewGroupElement.SLIDING_WINDOW_WIDTH,
        selectedViewIndex - ViewGroupElement.SLIDING_WINDOW_PADDING - 1
      );
    } else if (selectedViewIndex == this.#slidingWindowIndex) {
      // Case 3: The view is at the very start of the sliding window.
      //
      // We slide the sliding window -1 index, or to 0 if we're at the
      // start of the views array.
      this.#slidingWindowIndex = Math.max(0, this.#slidingWindowIndex - 1);
    } else if (
      selectedViewIndex ==
      this.#slidingWindowIndex + ViewGroupElement.SLIDING_WINDOW_WIDTH - 1
    ) {
      // Case 4: The view is at the very end of the sliding window
      //
      // We slide the sliding window +1 index, or to the sliding window
      // width at the end of the views array - whichever is smaller.
      this.#slidingWindowIndex = Math.min(
        this.viewGroup.length - ViewGroupElement.SLIDING_WINDOW_WIDTH,
        this.#slidingWindowIndex + 1
      );
    }
    // else Case 5: The view is within the sliding window and the window doesn't
    // need to be moved.

    let slidingWindowEndIndex = Math.min(
      this.#slidingWindowIndex + ViewGroupElement.SLIDING_WINDOW_WIDTH - 1,
      this.viewGroup.length - 1
    );
    let viewGroupHistory = [];

    // Now, for each item in the sliding window, default to styling them
    // as large.
    for (
      let index = this.#slidingWindowIndex;
      index <= slidingWindowEndIndex;
      ++index
    ) {
      viewGroupHistory.push({
        view: this.viewGroup.at(index),
        size: "large",
      });
    }

    // If there are any items before the sliding window, set the styling
    // of the first view in the window to medium, and then add an extra
    // history item for the previous view styled to small.
    if (this.#slidingWindowIndex > 0) {
      viewGroupHistory[0].size = "medium";
      viewGroupHistory.unshift({
        view: this.viewGroup.at(this.#slidingWindowIndex - 1),
        size: "small",
      });
    }

    // Similarly, if there are any items after the sliding window, set
    // the styling of the last item in the window to medium, and then add
    // an extra history item for the next view styled to small.
    if (slidingWindowEndIndex < this.viewGroup.length - 1) {
      viewGroupHistory[viewGroupHistory.length - 1].size = "medium";
      viewGroupHistory.push({
        view: this.viewGroup.at(slidingWindowEndIndex + 1),
        size: "small",
      });
    }

    return viewGroupHistory;
  }

  /**
   * Given an array length and an index, this will return the starting
   * index of a "sliding window" slice of the array centered around
   * the passed in index. This uses the SLIDING_WINDOW_PADDING and
   * SLIDING_WINDOW_WIDTH static values to define the sliding window
   * it's calculating.
   *
   * So, for example, suppose we have these values:
   *
   * SLIDING_WINDOW_PADDING = 2
   * SLIDING_WINDOW_WIDTH = 5
   *
   * and then:
   *
   * arrayLength = 12
   * index = 1
   *
   * The sliding window index returned should be 0 since the passed index
   * is SLIDING_WINDOW_PADDING indexes away from 0.
   *
   * Here's a visual representation, with curly braces around the sliding
   * window, where x represents an array item and X represents the array
   * item at the passed index.
   *
   * [{x,X,x,x,x},x,x,x,x,x,x,x]
   *
   *
   * Let's do another example with these values:
   *
   * arrayLength = 12
   * index = 4
   *
   * The sliding window index returned should then be 2.
   *
   * Here's a visual representation, with curly braces around the sliding
   * window.
   *
   * [x,x,{x,x,X,x,x},x,x,x,x,x]
   *
   *
   * One more example with these values:
   *
   * arrayLength = 12
   * index = 11
   *
   * The sliding window index returned should be 7.
   *
   * Here's a visual representation, with curly braces around the sliding
   * window.
   *
   * [x,x,x,x,x,x,x,{x,x,x,x,X}]
   *
   * @param {number} arrayLength
   *   The length of the array to find the sliding window index for.
   * @param {number} index
   *   The index of the selected item within the array to try to fit
   *   the sliding window around.
   * @return {number}
   */
  static #findSlidingWindowIndexCenteredAt(arrayLength, index) {
    if (
      arrayLength <= ViewGroupElement.SLIDING_WINDOW_WIDTH ||
      index <= ViewGroupElement.SLIDING_WINDOW_PADDING
    ) {
      return 0;
    }

    if (index >= arrayLength - ViewGroupElement.SLIDING_WINDOW_PADDING) {
      return arrayLength - ViewGroupElement.SLIDING_WINDOW_WIDTH;
    }

    return index - ViewGroupElement.SLIDING_WINDOW_PADDING;
  }

  /**
   * Returns the number of breadcrumbs that should ideally exist
   * in the sliding window, assuming the selected breadcrumb is
   * centered in the sliding window.
   */
  static get SLIDING_WINDOW_PADDING() {
    return 2;
  }

  /**
   * Returns the total expected width of the sliding window.
   */
  static get SLIDING_WINDOW_WIDTH() {
    return ViewGroupElement.SLIDING_WINDOW_PADDING * 2 + 1;
  }
}

customElements.define("view-group", ViewGroupElement);
