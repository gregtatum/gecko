/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

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

  async appendTopSites(history) {
    let domains = new Set();

    EXCLUDED_DOMAINS.forEach(excluded => domains.add(excluded));
    for (let site of history) {
      if (site.type == site.RESULT_TYPE_URI && site.title) {
        if (domains.has(site.uriHost)) {
          continue;
        }
        let placesData = window.CompanionUtils.getPlacesData(site.uri);
        if (!placesData) {
          continue;
        }
        domains.add(site.uriHost);
        this.appendChild(
          new TopSite({
            url: site.uri,
            title: formatName(site.uriSpec),
            icon: placesData.icon,
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
        badge: await this.getUnreadCountAtom(),
        id: "gmail",
      })
    );
  }

  async getUnreadCountAtom() {
    if (window.CompanionUtils.isInAutomation) {
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

  connectedCallback() {
    this.appendTopSites(window.CompanionUtils.history);
  }
}

customElements.define("e-topsites", TopSites);
