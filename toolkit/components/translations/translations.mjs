/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * While the feature is in development, hide the feature behind a pref. See
 * browser/app/profile/firefox.js for the status of enabling this project.
 */
function updateEnabledState() {
  if (Services.prefs.getBoolPref("browser.translation.enable")) {
    document
      .querySelector("title")
      .setAttribute("data-l10n-id", "about-translations-title");
    document.body.style.visibility = "visible";
  } else {
    document.querySelector("title").removeAttribute("data-l10n-id");
    document.body.style.visibility = "hidden";
    document.title = "about:translations";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  updateEnabledState();
  Services.prefs.addObserver("browser.translation.enable", updateEnabledState);
});
