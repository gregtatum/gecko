/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

const { OS } = ChromeUtils.import("resource://gre/modules/osfile.jsm");
const { Sqlite } = ChromeUtils.import("resource://gre/modules/Sqlite.jsm");

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
  }

  static prioritise(url) {
    // These will be in document order so frames in earlier sections will appear earlier.
    let keyframes = Array.from(
      document.querySelectorAll(`.keyframe[url="${CSS.escape(url)}"]`)
    );

    let first = keyframes.shift();
    if (first) {
      first.hidden = false;
      first.parentElement.updateVisibility();
    }

    for (let frame of keyframes) {
      frame.hidden = true;
      frame.parentElement.updateVisibility();
    }
  }

  updateDOM(target) {
    target.querySelector(".favicon").src = this.data.icon;
    target.querySelector(".title").textContent = this.data.title;
    target.querySelector(".title").setAttribute("title", this.data.title);
    if (this.data.totalEngagement) {
      target.querySelector(".total-engagement").textContent = textForTime(
        this.data.totalEngagement
      );
    }
    if (this.data.lastVisit) {
      target.querySelector(".last-access").textContent = timeFormat.format(
        this.data.lastVisit
      );
    }
  }

  update(data) {
    if (data.url != this.data.url) {
      this.setAttribute("url", data.url);
      Keyframe.prioritise(this.data.url);
      Keyframe.prioritise(data.url);
    }

    this.data = data;
    this.updateDOM(this);
  }

  connectedCallback() {
    this.className = "keyframe card";
    this.setAttribute("url", this.data.url);

    let template = document.getElementById("template-keyframe");
    let fragment = template.content.cloneNode(true);
    this.updateDOM(fragment);

    this.appendChild(fragment);
    this.addEventListener("click", this);

    Keyframe.prioritise(this.data.url);
  }

  disconnectedCallback() {
    Keyframe.prioritise(this.data.url);
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
  }

  connectedCallback() {
    let shadow = this.attachShadow({ mode: "open" });
    let template = document.getElementById("template-keyframe-list");
    let fragment = template.content.cloneNode(true);
    fragment.querySelector(".list-title").textContent = this.title;

    shadow.appendChild(fragment);
  }

  updateVisibility() {
    for (let keyframe of this.childNodes) {
      if (!keyframe.hidden) {
        this.hidden = false;
        return;
      }
    }

    this.hidden = true;
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
    this.replaceChildren(...elements);

    if (!elements.length) {
      this.hidden = true;
    }
  }
}

customElements.define("e-keyframelist", KeyframeList);

function textForTime(time) {
  time = Math.floor(time / 1000);

  if (time == 1) {
    return "1 second";
  }
  if (time <= 60) {
    return `${time} seconds`;
  }

  time = Math.floor(time / 60);
  if (time == 1) {
    return "1 minute";
  }
  return `${time} minutes`;
}

export const today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);

// Yes I know this is wrong in various cases.
export const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
export const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

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
