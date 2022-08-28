/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

function hideCompanionUI() {
  window.AWSendToParent("SPECIAL_ACTION", { type: "HIDE_COMPANION_UI" });
}

function showCompanionUI() {
  window.AWSendToParent("SPECIAL_ACTION", { type: "SHOW_COMPANION_UI" });
}

function init() {
  let doneBtn = document.getElementById("done");
  doneBtn.addEventListener(
    "click",
    evt => {
      evt.preventDefault();
      showCompanionUI();
      window.location = "about:blank";
    },
    { once: true }
  );

  hideCompanionUI();
}

window.addEventListener("load", init, { once: true });

// If users leave about:welcome by typing in the urlbar, ensure the toolbar
// buttons are redisplayed.
window.addEventListener(
  "beforeunload",
  () => {
    showCompanionUI();
  },
  { once: true }
);
