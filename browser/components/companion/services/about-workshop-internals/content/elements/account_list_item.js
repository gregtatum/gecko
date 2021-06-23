/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class AccountListItem extends HTMLElement {
  constructor(item) {
    super();
    this.item = item;

    const template = document.getElementById("template-account-list-item");
    const frag = template.content.cloneNode(true);
    frag
      .querySelector(".account-show-folders")
      .addEventListener("click", this.onShowFolders.bind(this));
    frag
      .querySelector(".account-sync-folders")
      .addEventListener("click", this.onSyncFolders.bind(this));
    frag
      .querySelector(".account-re-create")
      .addEventListener("click", this.onReCreate.bind(this));
    frag
      .querySelector(".account-delete")
      .addEventListener("click", this.onDelete.bind(this));
    this.appendChild(frag);
    this.setAttribute("class", template.getAttribute("class"));
  }

  update() {
    const account = this.item;

    this.querySelector(".account-name").textContent = account.name;
    this.querySelector(".account-type").textContent = account.type;
  }

  onShowFolders() {
    window.ROUTER.navigateTo(["account", this.item.id]);
  }

  onSyncFolders() {
    this.item.syncFolderList();
  }

  onReCreate() {
    this.item.recreateAccount();
  }

  onDelete() {
    this.item.deleteAccount();
  }
}
customElements.define("awi-account-list-item", AccountListItem);
