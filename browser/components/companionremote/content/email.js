/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

export async function getUnreadCountAtom() {
  if (Cu.isInAutomation) {
    return 0;
  }
  let response = await fetch("https://mail.google.com/mail/u/0/feed/atom");

  if (!response.ok) {
    // If we don't have an atom feed, click will just login
    return 0;
  }

  let results = await response.text();

  let doc = new DOMParser().parseFromString(results, "text/xml");

  return parseInt(doc.querySelector("fullcount").textContent);
}
