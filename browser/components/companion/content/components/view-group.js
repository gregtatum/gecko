/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { MozLitElement } from "chrome://browser/content/companion/widget-utils.js";
import {
  html,
  classMap,
  ifDefined,
} from "chrome://browser/content/companion/lit.all.js";

class ViewGroup extends MozLitElement {
  static get properties() {
    return {
      views: { type: Object },
      activeView: { type: Object },
      active: { type: Boolean },
    };
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
      detail: { clickedView: this.views[this.views.length - 1] },
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

  render() {
    const DEFAULT_FAVICON = "chrome://global/skin/icons/defaultFavicon.svg";

    let iconURL = DEFAULT_FAVICON;
    let view = this.active
      ? this.activeView
      : this.views[this.views.length - 1];

    if (view.iconURL || view.url) {
      iconURL = view.iconURL ?? `page-icon:${view.url.spec}`;
    }

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
      <link
        rel="stylesheet"
        href="chrome://browser/content/companion/components/view-group.css"
        type="text/css"
      />
      <div class="view-el" title=${ifDefined(rootTitle)}>
        <img class="view-icon" src=${iconURL} part="icon"></img>
        <div class="view-label-container" part="label-container">
          <div class="view-title"
               part="title"
               title=${view.title}>${view.title}</div>
          <div class="view-domain" part="domain">${domain}</div>
          <div class="view-history" part="history">${history}</div>
        </div>
      </div>
    `;
  }
}

customElements.define("view-group", ViewGroup);
