/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

const { OS } = ChromeUtils.import("resource://gre/modules/osfile.jsm");
const { Sqlite } = ChromeUtils.import("resource://gre/modules/Sqlite.jsm");
const { _LastSession } = ChromeUtils.import(
  "resource:///modules/sessionstore/SessionStore.jsm"
);

const NUM_KEYFRAMES = 20;

let sessionStart = new Date();
let lastSessionEnd = _LastSession.getState()?.session?.lastUpdate;

const NavHistory = Cc["@mozilla.org/browser/nav-history-service;1"].getService(
  Ci.nsINavHistoryService
);

class HidableElement extends HTMLElement {
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

export class Keyframe extends HidableElement {
  constructor(data) {
    super();
    this.data = data;

    this.className = "keyframe card";

    let template = document.getElementById("template-keyframe");
    let fragment = template.content.cloneNode(true);
    this.updateDOM(fragment);

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  updateDOM(target) {
    target.querySelector(".favicon").src = this.data.icon;
    target.querySelector(".title").textContent = this.data.title;
    target.querySelector(".title").setAttribute("title", this.data.title);

    let score = target.querySelector(".score");
    score.textContent = this.data.score.toFixed(1);
    score.setAttribute(
      "title",
      `Engagement: ${(this.data.totalEngagement / 1000).toFixed(1)}s
Typing time: ${(this.data.typingTime / 1000).toFixed(1)}s
Keypresses: ${this.data.keypresses}

Typing ratio: ${Math.round(
        (100 * this.data.typingTime) / this.data.totalEngagement
      )}%
Characters per second: ${
        this.data.keypresses == 0
          ? 0
          : Math.round(this.data.keypresses / (this.data.typingTime / 1000))
      }`
    );

    if (this.data.lastVisit) {
      target.querySelector(".last-access").textContent = timeFormat.format(
        this.data.lastVisit
      );
    }
  }

  update(data) {
    this.data = data;
    this.updateDOM(this);
  }

  handleEvent() {
    openUrl(this.data.url);
  }
}

customElements.define("e-keyframe", Keyframe);

export class KeyframeList extends HidableElement {
  constructor(title) {
    super();

    this.title = title;
    let shadow = this.attachShadow({ mode: "open" });
    let template = document.getElementById("template-keyframe-list");
    let fragment = template.content.cloneNode(true);
    fragment.querySelector(".list-title").textContent = this.title;

    shadow.appendChild(fragment);
  }

  displayFrames(frames) {
    let elements = frames.map(frame => {
      let element = this.querySelector(
        `.keyframe[url="${CSS.escape(frame.url)}"`
      );
      if (element) {
        element.update(frame);
        return element;
      }

      return new Keyframe(frame);
    });
    this.replaceChildren(...elements.slice(0, NUM_KEYFRAMES));

    this.hidden = !elements.length;
  }
}

customElements.define("e-keyframelist", KeyframeList);

export const today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);

// Yes I know this is wrong in various cases.
export const tomorrow = new Date(today + 24 * 60 * 60 * 1000);

let yesterday = new Date(today - 24 * 60 * 60 * 1000);
// If yesterday is before the start of the session then push back by the time since the end of the
// the last session
if (yesterday < sessionStart && lastSessionEnd) {
  yesterday = new Date(yesterday - (sessionStart - lastSessionEnd));
}
export { yesterday };

export const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

export const dateFormat = new Intl.DateTimeFormat([], {
  dateStyle: "short",
});

async function getPreviewImageURL(url) {
  let placesDbPath = OS.Path.join(
    OS.Constants.Path.profileDir,
    "places.sqlite"
  );
  let previewImage;
  let db = await Sqlite.openConnection({ path: placesDbPath });
  let sql = "SELECT * FROM moz_places WHERE url = :url;";
  let rows = await db.executeCached(sql, { url });
  if (rows.length) {
    for (let row of rows) {
      previewImage = row.getResultByName("preview_image_url");
      if (previewImage) {
        break;
      }
    }
  }

  await db.close();
  return previewImage;
}

function getFavicon(page, width = 0) {
  return new Promise(resolve => {
    let service = Cc["@mozilla.org/browser/favicon-service;1"].getService(
      Ci.nsIFaviconService
    );
    service.getFaviconDataForPage(
      Services.io.newURI(page),
      (uri, dataLength, data) => {
        if (uri) {
          resolve(uri.spec);
        } else {
          resolve(null);
        }
      },
      width
    );
  });
}

let cache = new Map();
export async function getPlacesData(url) {
  if (cache.has(url)) {
    return cache.get(url);
  }

  let query = NavHistory.getNewQuery();
  query.uri = Services.io.newURI(url);

  let queryOptions = NavHistory.getNewQueryOptions();
  queryOptions.resultType = Ci.nsINavHistoryQueryOptions.RESULTS_AS_URI;
  queryOptions.maxResults = 1;

  let results = NavHistory.executeQuery(query, queryOptions);
  results.root.containerOpen = true;
  try {
    if (results.root.childCount < 1) {
      return null;
    }

    let result = results.root.getChild(0);
    let favicon = await getFavicon(url, 16);
    if (!favicon) {
      cache.set(url, null);
      return null;
    }

    let data = {
      url,
      title: result.title,
      icon: favicon,
      richIcon: await getFavicon(url),
      previewImage: await getPreviewImageURL(url),
    };
    cache.set(url, data);
    return data;
  } finally {
    results.root.containerOpen = false;
  }
}

export function openUrl(url) {
  let win = BrowserWindowTracker.getTopWindow({
    allowPopups: false,
  });

  if (win) {
    win.switchToTabHavingURI(url, true, {
      ignoreFragment: true,
    });
    return;
  }

  openTrustedLinkIn(url, "tab");
}

let loadCallbacks = new Set();
let loaded = false;
export function onLoad(cb) {
  if (loaded) {
    cb();
  } else {
    loadCallbacks.add(cb);
  }
}

let unloadCallbacks = new Set();
export function onUnload(cb) {
  unloadCallbacks.add(cb);
}

function onUnloaded() {
  for (let cb of unloadCallbacks) {
    cb();
  }
}

function onLoaded() {
  loaded = true;
  window.addEventListener("unload", onUnloaded, { once: true });

  for (let cb of loadCallbacks) {
    cb();
  }
}

window.addEventListener("load", onLoaded, { once: true });
