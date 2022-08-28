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

    // Shuffle the mozproduct-rows so that a different set of them appear each
    // time in a different order.
    let mozproducts = document.querySelectorAll(".mozproduct-shuffle");
    let mozproductGroup = mozproducts[0].parentElement;
    for (let i = 0; i < mozproducts.length - 1; i++) {
      let j = Math.floor(Math.random() * (mozproducts.length - i)) + i;
      // Prepending an existing child will remove it and re-add it. This is just
      // a modified Fisher-Yates shuffle
      mozproductGroup.prepend(mozproducts[j]);
    }
    document
      .getElementById("mozproductsViewMore")
      .addEventListener("click", () => {
        mozproductGroup.setAttribute("viewall", "true");
      });

    const mozproductButtons = [
      ["mozproductVpnButton", "https://vpn.mozilla.org/"],
      ["mozproductRallyButton", "https://rally.mozilla.org/"],
      ["mozproductFoundationButton", "https://foundation.mozilla.org/"],
      [
        "mozproductPocketButton",
        "https://www.mozilla.org/en-US/firefox/pocket/",
      ],
    ];
    for (let [id, href] of mozproductButtons) {
      document.getElementById(id).addEventListener("click", () => {
        window.browsingContext.topChromeWindow.openTrustedLinkIn(href, "tab", {
          fromChrome: true,
        });
      });
    }

    const shellService = window.getShellService();
    const needPin = await shellService.doesAppNeedPin();
    document.getElementById("pinAppPane").hidden = !needPin;

    buildFirefoxAccount();
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
