/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

import { getPlacesData } from "./shared.js";
import { Email } from "./email.js";

export class WindowList extends HTMLElement {
  constructor(title) {
    super();
    this.render = this.render.bind(this);
    this.title = title;
    let shadow = this.attachShadow({ mode: "open" });
    let template = document.getElementById("template-window-list");
    let fragment = template.content.cloneNode(true);
    fragment.querySelector(".list-title").textContent = this.title;
    fragment
      .querySelector(".add-pinned-tab")
      .addEventListener("click", () => this.addPinnedTab());
    shadow.appendChild(fragment);
    this.windowListener = () => this.render();
    this.knownWindows = new WeakSet();
  }
  connectedCallback() {
    this.render();
    document.addEventListener("CompanionObservedPrefChanged", this.render);
    Services.obs.addObserver(
      this.windowListener,
      "browser-window-tracker-change"
    );
    Services.obs.addObserver(
      this.windowListener,
      "browser-window-tracker-new-tab"
    );
  }
  disconnectedCallback() {
    document.removeEventListener("CompanionObservedPrefChanged", this.render);
    Services.obs.addObserver(
      this.windowListener,
      "browser-window-tracker-change"
    );
    Services.obs.removeObserver(
      this.windowListener,
      "browser-window-tracker-new-tab"
    );
  }

  addPinnedTab() {
    let win = BrowserWindowTracker.getTopWindow({
      allowPopups: false,
    });

    if (win) {
      let tab = win.gBrowser.addWebTab("about:blank", {
        pinned: true,
      });
      win.gBrowser.selectedTab = tab;
      win.focus();
    }

    this.render();
  }

  get enabled() {
    return Services.prefs.getBoolPref("browser.companion.appbar");
  }

  render() {
    if (!this.enabled) {
      this.hidden = true;
      return;
    }

    this.hidden = false;
    let orderedWindows = BrowserWindowTracker.orderedWindows;
    console.debug(`Windows: render (${orderedWindows.length})`);
    this.innerHTML = "";

    for (let win of orderedWindows) {
      if (!this.knownWindows.has(win)) {
        this.knownWindows.add(win);
        win.addEventListener("TabPinned", () => this.render());
        win.addEventListener("TabUnpinned", () => this.render());
      }

      this.append(new Window(win));
    }
  }
}

export class Window extends HTMLElement {
  constructor(win) {
    super();
    this.win = win;
    this.className = "window";
    let shadow = this.attachShadow({ mode: "open" });
    let template = document.getElementById("template-window");
    let fragment = template.content.cloneNode(true);
    shadow.appendChild(fragment);
  }

  connectedCallback() {
    this.render();
  }

  render() {
    let win = this.win;

    this.innerHTML = "";
    let visibleTabs = win.gBrowser.visibleTabs;
    let pinnedTabs = visibleTabs.filter(t => t.pinned);

    if (!pinnedTabs.length) {
      return;
    }

    this.setAttribute("title", `${visibleTabs.length} tabs`);

    for (let tab of pinnedTabs) {
      this.append(new App(tab));
    }
  }
}

export class App extends HTMLElement {
  constructor(tab) {
    super();
    this.tab = tab;
    let template = document.getElementById("template-app");
    let fragment = template.content.cloneNode(true);
    this.append(fragment);
    this.switchToAppButton.addEventListener("click", () => {
      // i'm sure there's a better way to do this
      this.tab.ownerGlobal.gBrowser.selectedTab = this.tab;
      this.tab.ownerGlobal.focus();
    });
  }

  connectedCallback() {
    this.render();
  }

  get switchToAppButton() {
    return this.querySelector(".switch-to-app");
  }

  get extraDetails() {
    return this.querySelector("details");
  }

  get extraDetailsSummary() {
    return this.querySelector("details summary");
  }
  get extraDetailsContent() {
    return this.querySelector("details .extra-details-content");
  }

  get title() {
    return this.querySelector(".title");
  }

  get favicon() {
    return this.querySelector(".favicon");
  }

  async renderExtraDetails() {
    // For now, just wire up to atom
    if (this.tab.linkedBrowser?.currentURI?.host != "mail.google.com") {
      this.extraDetails.hidden = true;
      return;
    }

    let emails = await getUnreadEmailAtom();

    this.extraDetails.hidden = false;
    this.extraDetails.open = true;
    this.extraDetailsSummary.textContent = "Recent emails";
    this.extraDetailsContent.innerHTML = "";

    for (let email of emails) {
      this.extraDetailsContent.append(new Email(null, email));
    }
  }

  async render() {
    let url = this.tab.linkedBrowser?.currentURI?.spec;
    if (!url) {
      return;
    }

    let data = await getPlacesData(url);

    if (!data) {
      this.hidden = true;
      return;
    }

    this.hidden = false;
    this.favicon.src = data.icon;
    this.title.textContent = data.title;

    await this.renderExtraDetails();

    /*
    const { PageThumbs } = ChromeUtils.import(
    "resource://gre/modules/PageThumbs.jsm"
    );

    let fullScale = true;
    let canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;

    PageThumbs.captureToCanvas(tab.linkedBrowser, canvas, {
      fullScale,
      targetWidth: 32,
    }).catch((e) => Cu.reportError(e));

    this.append(canvas);
    */
  }
}

customElements.define("e-window-list", WindowList);
customElements.define("e-window", Window);
customElements.define("e-app", App);

// TODO:
// This is copy/pasted from OnlineServices.jsm - how can we share this
// Who should own caching values, refetching on an interval, etc
async function getUnreadEmailAtom() {
  let response = await fetch("https://mail.google.com/mail/u/0/feed/atom");

  if (!response.ok) {
    if (response.status == 403) {
      // Atom feed won't work unless we've navigated to the inbox
      openTrustedLinkIn("https://mail.google.com/mail/u/0/ =", "tab");
      // Should set a timer to recheck mail
      return [];
    }
    throw new Error(response.statusText);
  }

  let results = await response.text();

  let doc = new DOMParser().parseFromString(results, "text/xml");

  let entries = doc.querySelectorAll("entry");

  let messages = [];

  for (let entry of entries) {
    let message = {};
    message.subject = entry.querySelector("title").textContent;
    message.from = `${entry.querySelector("author > name").textContent} <${
      entry.querySelector("author > email").textContent
    }>`;
    message.url = entry.querySelector("link").getAttribute("href");
    message.date = new Date(entry.querySelector("issued").textContent);
    messages.push(message);
  }

  return messages;
}
