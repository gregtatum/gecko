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
  }

  /**
   * Returns the View that the majority of the ViewGroup component
   * represents.
   */
  get lastView() {
    return this.views[this.views.length - 1];
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
          <span
            class=${classMap(classes)}
            .view=${this.views[i]}
            @click=${this.#onHistoryClick}
            title=${this.views[i].title}
          ></span>
        `
      );
    }

    // If we're not active, then we want the entire ViewGroup to show
    // a tooltip when hovered showing the title of the last View.
    // If, however, we're active, then we'll have the view-title be
    // the element show the tooltip to avoid conflicting with tooltips
    // on any history "breadcrumbs".
    let rootTitle = this.active ? undefined : view.title;

    return html`
      <div class="view-el" title=${ifDefined(rootTitle)}>
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
        <img class="page-action-button" ?hidden=${!this.active}
             src="chrome://global/skin/icons/arrow-down.svg"
             @click="${this.#pageActionButtonClicked}"
        ></img>
      </div>
    `;
  }

  /**
   * Determines whether or not two Views should be put into the same
   * ViewGroup.
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

    return isSameOrigin && viewA.iconURL == viewB.iconURL;
  }
}

customElements.define("view-group", ViewGroup);
