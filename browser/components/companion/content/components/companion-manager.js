/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global MozXULElement, Services */

/**
 * CompanionManager looks after the display of the companion sidebar.
 */
class CompanionManager extends MozXULElement {
  #companionBox;
  #isOpen = true;

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

    this.destroy = this.destroy.bind(this);
  }

  connectedCallback() {
    this.#updateVisibility();

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
    Services.xulStore.persist(this, "width");
  }

  get isOpen() {
    return this.#isOpen;
  }

  toggleVisible() {
    this.#isOpen = !this.#isOpen;
    this.#updateVisibility();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name == "width" && newValue) {
      document.documentElement.style.setProperty(
        "--companion-width",
        newValue + "px"
      );
    }
  }

  #updateVisibility() {
    if (this.#isOpen) {
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
