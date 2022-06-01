/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

window.onload = event => {
  let button = document.getElementById("completeButton");
  button.addEventListener("click", buttonClicked);
};

function buttonClicked() {
  let event = new CustomEvent("OnboardingCompleted", { bubbles: true });
  document.dispatchEvent(event);
}
