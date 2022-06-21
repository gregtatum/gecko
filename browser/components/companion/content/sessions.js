/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

import { timeSince } from "./time-since.js";

const { CommonNames } = ChromeUtils.import(
  "resource:///modules/CommonNames.jsm"
);

const SESSIONS_ENABLED_PREF = "browser.places.perwindowsessions.enabled";
const DEFAULT_FAVICON = "chrome://global/skin/icons/defaultFavicon.svg";

const MAX_ICONS = 7;

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

export function initSessionUI() {
  document
    .getElementById("session-cleared-link")
    .addEventListener("click", () => {
      document.getElementById("companion-deck").selectedViewName = "browse";
    });
  document.getElementById("flow-reset-close").addEventListener("click", () => {
    document.body.setAttribute("flow-reset-startup", true);
    document.body.removeAttribute("flow-reset");
  });
}

export class SessionCard extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;
    this.className = "session card";

    this.setAttribute("aria-expanded", false);
    let template = document.getElementById("template-session-card");
    let fragment = template.content.cloneNode(true);

    fragment.querySelector(".pages").dataset.l10nArgs = JSON.stringify({
      pages: data.pages.length,
    });
    fragment.querySelector(".date").textContent = timeSince(data.lastSavedAt);
    fragment.querySelector(".title").textContent = sessionTitle(data);

    let pages = data.pages.slice(0, MAX_ICONS);
    let icons = pages.map(page => {
      let img = document.createElement("img");
      img.className = "icon";
      img.src = pageToDataURI(page);
      return img;
    });

    if (data.pages.length > MAX_ICONS) {
      let overflow = document.createElement("span");
      overflow.className = "icon";
      overflow.textContent = `+${data.pages.length - MAX_ICONS}`;
      icons.push(overflow);
    }
    /*fragment.querySelector(".card-image > img").src = pageToDataURI(
      data.pages[0]
    );*/
    fragment.querySelector(".icons").replaceChildren(...icons);

    this.addEventListener("click", this);
    let cardToggleButton = fragment.querySelector(".session-card-toggle");
    cardToggleButton.addEventListener("click", this);

    let restoreBtn = fragment.querySelector(".restore-button");
    restoreBtn.addEventListener("click", this);
    restoreBtn.dataset.session = data.guid;

    let hideBtn = fragment.querySelector("#session-hide");
    hideBtn.addEventListener("click", this);
    hideBtn.dataset.session = data.guid;

    this.appendChild(fragment);
  }

  handleEvent(event) {
    switch (event.target.dataset.action) {
      case "restore-session": {
        window.CompanionUtils.sendAsyncMessage("Companion:RestoreSession", {
          guid: event.target.dataset.session,
        });
        break;
      }
      case "hide-session": {
        window.CompanionUtils.sendAsyncMessage("Companion:HideSession", {
          guid: event.target.dataset.session,
        });
        break;
      }
      default:
        this.#expandCard(event);
    }
  }

  #expandCard(event) {
    // We do not want the click event from the button to propagate up to
    // the card itself. This prevents an immediate "double toggle" of the card.
    if (event.target.className === "session-card-toggle") {
      event.stopPropagation();
    }
    this.classList.toggle("expanded");
    let panelExpanded = this.classList.contains("expanded");
    this.setAttribute("aria-expanded", String(panelExpanded));
    let restoreButton = this.querySelector(".restore-button");
    restoreButton.setAttribute("aria-hidden", String(!panelExpanded));
    if (panelExpanded) {
      restoreButton.focus();
    }
  }
}

class SessionList extends HTMLElement {
  constructor({ showTitle = false, initialSessionData = null } = {}) {
    super();
    this.className = "last-session-list";
    this.initialSessionData = window.CompanionUtils.initialSessionData();

    let template = document.getElementById("template-session-list");
    let fragment = template.content.cloneNode(true);

    if (showTitle) {
      fragment.querySelector("h2").hidden = false;
    }

    this.appendChild(fragment);

    this.hidden = !window.CompanionUtils.getBoolPref(
      SESSIONS_ENABLED_PREF,
      false
    );
  }

  connectedCallback() {
    if (this.initialSessionData != null) {
      this.sessionUpdated(this.initialSessionData);
    }
    window.addEventListener("Companion:SessionUpdated", this);
    window.CompanionUtils.sendAsyncMessage("Companion:FetchSessionData");
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

  sessionUpdated(sessions) {
    let panel = this.querySelector(".last-sessions-panel");
    let fragment = new DocumentFragment();
    for (const session of sessions) {
      fragment.appendChild(new SessionCard(session));
      if (this.limitSessionCards) {
        break;
      }
    }
    panel.replaceChildren(fragment);
  }
}

export class LastSessionList extends SessionList {
  get limitSessionCards() {
    return true;
  }
}

export class FullSessionList extends SessionList {
  get limitSessionCards() {
    return false;
  }
}

customElements.define("e-session-card", SessionCard);
customElements.define("last-session-list", LastSessionList);
customElements.define("full-session-list", FullSessionList);
