/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

const PREF_BRANCH = "companion.range.";

export class Range extends HTMLElement {
  constructor(id, label, min, max, step, value) {
    super();

    this.id = id;
    this.className = "range";

    value = parseFloat(Services.prefs.getCharPref(PREF_BRANCH + id, value));

    let template = document.getElementById("template-range");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".range-label").textContent = label;
    this.display = fragment.querySelector(".range-value");
    this.slider = fragment.querySelector(".range-slider");
    this.slider.setAttribute("min", min);
    this.slider.setAttribute("max", max);
    this.slider.setAttribute("step", step);
    this.slider.setAttribute("value", value);

    this.slider.addEventListener("input", () => {
      Services.prefs.setCharPref(PREF_BRANCH + id, this.value);
      this.updateValue();
    });
    this.appendChild(fragment);

    this.updateValue();
  }

  get value() {
    return this.slider.valueAsNumber;
  }

  updateValue() {
    this.display.textContent = this.value.toFixed(1);
  }
}

customElements.define("e-range", Range);
