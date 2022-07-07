/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

window.onload = event => {
  let completeButton = document.getElementById("completeButton");
  completeButton.addEventListener("click", buttonClicked);
  let fxaButton = document.getElementById("openFxa");
  fxaButton.addEventListener("click", openFxa);
};

function buttonClicked() {
  let event = new CustomEvent("OnboardingCompleted", { bubbles: true });
  document.dispatchEvent(event);
}

function openFxa() {
  let event = new CustomEvent("OpenFxa", { bubbles: true });
  document.dispatchEvent(event);
}
