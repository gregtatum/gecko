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

export default class ViewGroup extends MozLitElement {
  static get queries() {
    return {
      iconContainer: ".view-icon-container",
    };
  }

  static get properties() {
    return {
      views: { type: Object },
      activeView: { type: Object },
      active: { type: Boolean },
      busyAnimating: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      @import url("chrome://browser/content/companion/components/view-group.css");
    `;
  }

  constructor() {
    super();
    this.views = [];
    this.activeView = null;
    this.busyAnimationTimeout = null;
    this.addEventListener("click", this.#onClick);
  }

  #onClick(event) {
    let e = new CustomEvent("UserAction:ViewSelected", {
      bubbles: true,
      composed: true,
      detail: { clickedView: this.lastView },
    });
    this.dispatchEvent(e);
  }

  #onHistoryClick(event) {
    let view = event.target.view;
    let e = new CustomEvent("UserAction:ViewSelected", {
      bubbles: true,
      composed: true,
      detail: { clickedView: view },
    });
    this.dispatchEvent(e);
    // We don't want this to get handled by the #onClick handler, since
    // that will then switch to the last View in this group.
    event.stopPropagation();
  }

  #pageActionButtonClicked(event) {
    let e = new CustomEvent("UserAction:OpenPageActionMenu", {
      bubbles: true,
      composed: true,
      detail: { view: this.activeView },
    });
    event.target.dispatchEvent(e);
    // We don't want this to get handled by the #onClick handler, since
    // that will then switch to the last View in this group.
    event.stopPropagation();
  }

  /**
   * Returns the View that the majority of the ViewGroup component
   * represents.
   */
  get lastView() {
    return this.views[this.views.length - 1];
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
    for (let i = 0; i < this.views.length; ++i) {
      let classes = {
        history: true,
        active: this.active && this.views[i] == this.activeView,
      };

      history.push(
        html`
          <button
            class=${classMap(classes)}
            .view=${this.views[i]}
            @click=${this.#onHistoryClick}
            title=${this.views[i].title}
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

    return html`
      <div class="view-el" title=${ifDefined(rootTitle)} ?busy=${
      view.busy
    } ?pause-animation=${!this.busyAnimating}>
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
          <div class="view-domain-container" part="domain">
            <div id="view-security-icon" class="${securityIconClass}"></div>
            <div class="view-domain">${domain}</div>
          </div>
          <div class="view-history" part="history">${history}</div>
        </div>
        <button class="page-action-button" ?hidden=${!this.active}
             @click="${this.#pageActionButtonClicked}"
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
}

customElements.define("view-group", ViewGroup);
