/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class MessageListItem extends HTMLElement {
  constructor(item) {
    super();
    this.item = item;

    const template = document.getElementById("template-message-list-item");
    const frag = template.content.cloneNode(true);
    this.appendChild(frag);
    this.setAttribute("class", template.getAttribute("class"));
  }

  async update() {
    const message = this.item;

    this.querySelector(".message-subject").textContent = message.subject;

    // ## Aside: Calendar Events as Messages
    //
    // Currently various calendar event metadata gets stored as attributes in a
    // body part which was done as a hack derived from the Phabricator and
    // Bugzilla accounts more appropriately storing their change histories as
    // attributes.
    //
    // This should be rectified by promoting the calendar data to exist on the
    // message (envelope), but for now be aware that the event data is oddly
    // in the body Blob.
    //
    // ## Presentation Here as Internals
    //
    // We just want to show the raw underlying JSON rep or raw HTML, so we do.
    //
    // A hack/limitation here is that we are regenerating these nodes on every
    // render call, but we can do better than this (and the glodastrophe
    // React setup did, for example).
    const bodyContainer = this.querySelector(".message-body-parts");

    const bodyNodes = [];
    for (const bodyRep of message.bodyReps) {
      const elem = document.createElement("div");
      const blobContents = await bodyRep.contentBlob.text();
      elem.textContent = blobContents;

      bodyNodes.append(elem);
    }

    bodyContainer.replaceChildren(bodyNodes);
  }

  onShowMessages() {
    this.item.syncFolderList();
  }

  onShowConversations() {
    this.item.recreateAccount();
  }
}
customElements.define("awi-message-list-item", MessageListItem);
