/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class FolderListItem extends HTMLElement {
  constructor(item) {
    super();
    this.item = item;

    const template = document.getElementById("template-folder-list-item");
    const frag = template.content.cloneNode(true);
    frag
      .querySelector(".folder-show-messages")
      .addEventListener("click", this.onShowMessages.bind(this));
    frag
      .querySelector(".folder-show-conversations")
      .addEventListener("click", this.onShowConversations.bind(this));
    this.appendChild(frag);
    this.setAttribute("class", template.getAttribute("class"));
  }

  update() {
    const folder = this.item;

    this.querySelector(".folder-name").textContent = folder.path;
    this.querySelector(".folder-type").textContent = folder.type;
  }

  onShowMessages() {
    window.ROUTER.navigateRelative(["folder", this.item.id]);
  }

  onShowConversations() {
    console.log("Not yet!");
  }
}
customElements.define("awi-folder-list-item", FolderListItem);
