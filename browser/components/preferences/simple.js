/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from preferences.js */
/* import-globals-from services.js */

let gSimplePane = {
  async init() {
    for (let id of ["viewAllSettings", "pinToTaskbarBtn"]) {
      document.getElementById(id).addEventListener("click", this);
    }

    const shellService = window.getShellService();
    const needPin = await shellService.doesAppNeedPin();
    document.getElementById("pinAppPane").hidden = !needPin;

    Services.obs.addObserver(() => {
      buildFirefoxAccount();
    }, "sync-pane-loaded");
    buildExtraServiceRows();
  },

  async handleEvent(event) {
    if (event.target?.id == "viewAllSettings") {
      document.documentElement.classList.remove("simple");
      await gotoPref("paneGeneral");
    } else if (event.target?.id == "pinToTaskbarBtn") {
      event.target.disabled = true;
      const shellService = window.getShellService();
      await shellService.pinToTaskbar();
    }
  },
};
