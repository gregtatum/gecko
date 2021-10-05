/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { timeSince } from "./time-since.js";

const { CommonNames } = ChromeUtils.import(
  "resource:///modules/CommonNames.jsm"
);

const SESSIONS_ENABLED_PREF = "browser.places.perwindowsessions.enabled";
const DEFAULT_FAVICON = "chrome://global/skin/icons/defaultFavicon.svg";

const MAX_ICONS = 4;

function sessionTitle(session) {
  return session.pages
    .map(page => CommonNames.getURLName(new URL(page.url)))
    .join(", ");
}

function pageToDataURI(page) {
  if (!page.favicon?.data) {
    return DEFAULT_FAVICON;
  }
  let b64 = btoa(
    page.favicon.data.reduce(
      (data, byte) => data + String.fromCharCode(byte),
      ""
    )
  );
  return `data:${page.favicon.mimeType};base64,${b64}`;
}

export class SessionCard extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;
    this.className = "session card";

    let template = document.getElementById("template-session-card");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".details").textContent = `${
      data.pages.length
    } sites • ${timeSince(data.lastSavedAt)}`;
    fragment.querySelector(".title").textContent = sessionTitle(data);

    data.pages.length = Math.min(data.pages.length, MAX_ICONS);
    let icons = data.pages.map(page => {
      let img = document.createElement("img");
      img.className = "icon";
      img.src = pageToDataURI(page);
      return img;
    });

    fragment.querySelector(".site-icon").src = pageToDataURI(data.pages[0]);
    fragment.querySelector(".icons").replaceChildren(...icons);
    fragment.querySelector(".session-card").addEventListener("click", this);

    let restoreBtn = fragment.querySelector(".restore-button");
    restoreBtn.addEventListener("click", this);
    restoreBtn.dataset.session = data.guid;

    this.appendChild(fragment);
  }

  handleEvent(event) {
    switch (event.type) {
      case "click": {
        let guid = event.target.dataset.session;
        if (guid) {
          window.CompanionUtils.sendAsyncMessage("Companion:RestoreSession", {
            guid,
          });
        } else {
          this.classList.toggle("expanded");
        }
        break;
      }
    }
  }
}

class HideableElement extends HTMLElement {
  get hidden() {
    return this.hasAttribute("hidden");
  }

  set hidden(val) {
    if (val) {
      this.setAttribute("hidden", "true");
    } else {
      this.removeAttribute("hidden");
    }
  }
}

export class LastSessionList extends HideableElement {
  constructor() {
    super();
    this.className = "last-session-list";

    let template = document.getElementById("template-last-session-list");
    let fragment = template.content.cloneNode(true);

    this.appendChild(fragment);

    this.hidden = !window.CompanionUtils.getBoolPref(
      SESSIONS_ENABLED_PREF,
      false
    );
  }

  connectedCallback() {
    window.addEventListener("Companion:SessionUpdated", this);
  }

  disconnectedCallback() {
    window.removeEventListener("Companion:SessionUpdated", this);
  }

  handleEvent(event) {
    switch (event.type) {
      case "Companion:SessionUpdated": {
        this.sessionUpdated(event.detail);
        break;
      }
    }
  }

  sessionUpdated(session) {
    if (!session.pages.length) {
      this.hidden = true;
      return;
    }
    let panel = this.querySelector(".last-sessions-panel");
    panel.replaceChildren(new SessionCard(session));
  }
}

customElements.define("e-session-card", SessionCard);
customElements.define("e-last-session-list", LastSessionList);
