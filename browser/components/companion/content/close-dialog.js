/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

document.addEventListener("DOMContentLoaded", init);

function init() {
  document.addEventListener("click", onClick);
}

function onClick(evt) {
  // Hide the dialog if either button was clicked.
  const isButtonClick = evt.target.closest("button");
  if (isButtonClick) {
    window.top.gDialogBox.replaceDialogIfOpen();
  }
}
