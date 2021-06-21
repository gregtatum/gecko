/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { getUnreadCountAtom } from "./email.js";

const { shortURL } = ChromeUtils.import(
  "resource://activity-stream/lib/ShortURL.jsm"
);

const NUM_TOPSITES = 4;

function formatName(url) {
  let shortName = shortURL({ url });
  const PREFIXES = [".google", ".mozilla"];
  for (const prefix of PREFIXES) {
    if (shortName.endsWith(prefix)) {
      shortName = shortName.slice(0, prefix.length);
    }
  }
  return shortName;
}

const EXCLUDED_DOMAINS = [
  // We have a special gmail top site, so exclude the domain to avoid dupes.
  "mail.google.com",
  // Exclude interstitial domains that could pop up during/after first run.
  "accounts.google.com",
  "accounts.firefox.com",
  "auth.mozilla.auth0.com",
];

export class TopSite extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;

    this.className = "topsite card";

    let template = document.getElementById("template-topsite");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".title").textContent = this.data.title;
    fragment
      .querySelector(".topsite-favicon img")
      .setAttribute("src", this.data.icon);
    if (this.data.badge) {
      fragment.querySelector(
        ".topsite-favicon .badge"
      ).textContent = this.data.badge;
      fragment.querySelector(".topsite-favicon .badge").hidden = false;
    }
    if (this.data.id) {
      this.id = this.data.id;
    }

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  handleEvent(event) {
    window.CompanionUtils.sendAsyncMessage("Companion:OpenURL", {
      url: this.data.url,
    });
  }
}

customElements.define("e-topsite", TopSite);

export class TopSites extends HTMLElement {
  constructor() {
    super();
    this.className = "topsites";
  }

  handleEvent() {
    this.appendTopSites(window.CompanionUtils.history);
  }

  async appendTopSites(history) {
    let domains = new Set();

    EXCLUDED_DOMAINS.forEach(excluded => domains.add(excluded));
    for (let site of history) {
      if (site.type == site.RESULT_TYPE_URI && site.title) {
        if (domains.has(site.uriHost)) {
          continue;
        }
        if (!site.icon) {
          continue;
        }
        domains.add(site.uriHost);
        this.appendChild(
          new TopSite({
            url: site.uri,
            title: formatName(site.uriSpec),
            icon: site.icon,
          })
        );
      }
      if (this.childNodes.length == NUM_TOPSITES) {
        break;
      }
    }

    // Add gmail
    this.appendChild(
      new TopSite({
        url: "https://mail.google.com",
        title: "gmail",
        icon: "chrome://browser/content/companion/email.svg",
        badge: await getUnreadCountAtom(),
        id: "gmail",
      })
    );
  }

  connectedCallback() {
    if (window.CompanionUtils.history.length) {
      this.appendTopSites(window.CompanionUtils.history);
    } else {
      window.addEventListener("Companion:Setup", this);
    }
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:Setup", this);
  }
}

customElements.define("e-topsites", TopSites);
