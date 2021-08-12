/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { css, html } from "../lit_glue.js";

import { Page } from "../page.js";

import "../elements/cal_event_list_item.js";
import "../elements/list_view.js";
import "../elements/message_list_item.js";

/**
 * List the messages in a folder.
 *
 * ## Lifecycle Notes
 *
 * Getting a folder can currently be asynchronous (because populating views is
 * inherently async and we don't have any invariants in place that ensure the
 * relevant view has already been populated).
 *
 * To deal with this, we mark the folder as reactive state so that we can
 * re-render once we have the folder.  We are then able to synchronously request
 * the contents of the folder during `willUpdate`.
 *
 * ### The folderId can't change
 *
 * Currently the router explicitly creates this element via `new` which means
 * there's no lit-html VDOM between us and the DOM which would attempt to work
 * with the reactive layer to reuse our element.  This means we don't need to
 * worry about the folderId changing.  However, willUpdate does pretend like
 * it's possible just for the sake of avoiding any footguns if this code gets
 * adopted to something more dynamic.
 */
export default class AccountFolderMessageContentsPage extends Page {
  static get properties() {
    return {
      folder: { state: true },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 1em;
      }
    `;
  }

  constructor(opts, { folderId }) {
    super(opts, {
      title: "Messages",
      pageId: "page-account-folder-message-contents",
    });

    this.folderId = folderId;
    this.folder = null; // (reactive!)
    this.listView = null;

    // This could have been called during the connected callback, but there's
    // no refcount associated with this.
    this.getFolder();
  }

  async getFolder() {
    this.folder = await this.workshopAPI.eventuallyGetFolderById(this.folderId);
  }

  willUpdate(changedProperties) {
    if (changedProperties.has("folderId")) {
      this.getFolder();
    }
    if (changedProperties.has("folder")) {
      if (this.listView) {
        this.listView.release();
        this.listView = null;
      }
      if (this.folder) {
        this.listView = this.workshopAPI.viewFolderMessages(this.folder);
        // Make sure a sync happens.
        this.listView.refresh();
      }
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.listView) {
      this.listView.release();
      this.listView = null;
    }
  }

  render(pageElem) {
    return html`
      <awi-list-view
        .listView=${this.listView}
        .factory=${item => {
          if (item.type === "cal") {
            return html`
              <awi-event-list-item .event=${item} .serial=${item.serial} />
            `;
          }
          return html`
            <awi-message-list-item .message=${item} .serial=${item.serial} />
          `;
        }}
      />
    `;
  }

  cleanup(pageElem) {
    pageElem.replaceChildren();
    if (this.listView) {
      this.listView.release();
      this.listView = null;
    }
  }
}
customElements.define(
  "awi-account-folder-message-contents-page",
  AccountFolderMessageContentsPage
);
