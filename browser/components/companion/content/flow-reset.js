/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Lazy bind the click events as l10n will replace the anchor elements
document.body.addEventListener("click", event => {
  let msg = event.target.dataset.message;
  if (["ViewCompanionBrowseTab", "RestoreLastSession"].includes(msg)) {
    window.dispatchEvent(new CustomEvent(msg, { bubbles: true }));
  }
});
