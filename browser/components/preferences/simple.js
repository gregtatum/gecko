/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* import-globals-from preferences.js */
/* import-globals-from services.js */
ChromeUtils.defineModuleGetter(
  this,
  "AddonManager",
  "resource://gre/modules/AddonManager.jsm"
);

let gSimplePane = {
  async init() {
    for (let id of ["viewAllSettings", "pinToTaskbarBtn", "themeChoice"]) {
      document.getElementById(id).addEventListener("click", this);
    }

    let themes = await AddonManager.getAddonsByTypes(["theme"]);
    let currentTheme = themes.find(theme => theme.isActive);
    for (let radioButton of document.getElementById("themeChoice").children) {
      let theme = themes.find(t => t.id == radioButton.value);
      if (radioButton.value == currentTheme.id) {
        radioButton.setAttribute("selected", true);
      } else {
        radioButton.removeAttribute("selected");
      }
      radioButton.theme = theme;
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
    } else if (event.target?.id.startsWith("theme-")) {
      await event.target?.theme.enable();
    }
  },
};
