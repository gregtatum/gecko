/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global MozXULElement, Services */

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

/**
 * CompanionManager looks after the display of the companion sidebar.
 */
class CompanionManager extends MozXULElement {
  #companionBox;

  static get markup() {
    return `
      <browser
        id="companion-browser"
        autoscroll="false"
        disablefullscreen="true"
        disablehistory="true"
        flex="1"
        message="true"
        messagemanagergroup="browsers"
        remoteType="privilegedabout"
        remote="true"
        selectmenulist="ContentSelectDropdown"
        src="chrome://browser/content/companion/companion.xhtml"
        type="content"
        />
    `;
  }

  static get observedAttributes() {
    return ["width"];
  }

  constructor() {
    super();

    XPCOMUtils.defineLazyPreferenceGetter(
      this,
      "isOpen",
      "companion.open",
      false,
      this.#onPreferenceChange.bind(this)
    );

    this.destroy = this.destroy.bind(this);
  }

  connectedCallback() {
    this.#onPreferenceChange(null, null, this.isOpen);

    this.appendChild(this.constructor.fragment);

    window.addEventListener("unload", this.destroy);
  }

  disconnectedCallback() {
    this.destroy();

    while (this.firstChild) {
      this.firstChild.remove();
    }
  }

  destroy() {
    window.removeEventListener("unload", this.destroy);
    let xulStore = Services.xulStore;
    xulStore.persist(this, "width");
  }

  toggleVisible() {
    Services.prefs.setBoolPref("companion.open", !this.isOpen);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name == "width" && newValue) {
      document.documentElement.style.setProperty(
        "--companion-width",
        newValue + "px"
      );
    }
  }

  #onPreferenceChange(pref, value, newValue) {
    if (newValue) {
      document.documentElement.setAttribute("companion", "true");
      document.documentElement.style.setProperty(
        "--companion-width",
        this.width + "px"
      );
    } else {
      document.documentElement.removeAttribute("companion");
      // Reset the width to 0 as the UI is not displayed.
      document.documentElement.style.setProperty("--companion-width", "0px");
    }
  }
}
customElements.define("companion-manager", CompanionManager);
