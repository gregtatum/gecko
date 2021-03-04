/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// These come from utilityOverlay.js
/* global openTrustedLinkIn, XPCOMUtils, BrowserWindowTracker, Services */

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  Keyframes: "resource:///modules/Keyframes.jsm",
  OS: "resource://gre/modules/osfile.jsm",
  PlacesUtils: "resource://gre/modules/PlacesUtils.jsm",
  Sqlite: "resource://gre/modules/Sqlite.jsm",
  UrlbarInput: "resource:///modules/UrlbarInput.jsm",
  UrlbarPrefs: "resource:///modules/UrlbarPrefs.jsm",
  UrlbarProviderSearchTips: "resource:///modules/UrlbarProviderSearchTips.jsm",
  UrlbarTokenizer: "resource:///modules/UrlbarTokenizer.jsm",
  UrlbarUtils: "resource:///modules/UrlbarUtils.jsm",
  OnlineServices: "resource:///modules/OnlineServices.jsm",
});

XPCOMUtils.defineLazyServiceGetters(this, {
  Favicons: ["@mozilla.org/browser/favicon-service;1", "nsIFaviconService"],
  NavHistory: [
    "@mozilla.org/browser/nav-history-service;1",
    "nsINavHistoryService",
  ],
});

let today = new Date();
today.setHours(0);
today.setMinutes(0);
today.setSeconds(0);
today.setMilliseconds(0);

// Yes I know this is wrong in various cases.
let tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

const timeFormat = new Intl.DateTimeFormat([], {
  timeStyle: "short",
});

const dateFormat = new Intl.DateTimeFormat([], {
  dateStyle: "short",
});

class Event extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;
  }

  connectedCallback() {
    this.className = "event card";

    let template = document.getElementById("template-event");
    let fragment = template.content.cloneNode(true);

    let date =
      this.data.start > tomorrow
        ? dateFormat.format(this.data.start)
        : timeFormat.format(this.data.start);

    fragment
      .querySelector(".favicon")
      .setAttribute("src", "chrome://browser/content/companion/event.svg");
    fragment.querySelector(".date").textContent = date;
    fragment.querySelector(".summary").textContent = this.data.summary;

    if (this.data.conference) {
      fragment.querySelector(
        ".conference-icon"
      ).src = this.data.conference.icon;
      fragment.querySelector(
        ".conference-label"
      ).textContent = this.data.conference.name;
    } else {
      fragment.querySelector(".conference").style.display = "none";
    }

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  handleEvent(event) {
    openUrl(this.data.conference.url);
  }
}

customElements.define("e-event", Event);

async function buildEvents(services) {
  let panel = document.getElementById("service-panel");
  while (panel.firstChild) {
    panel.firstChild.remove();
  }

  for (let service of services) {
    for (let event of await service.getNextMeetings()) {
      panel.appendChild(new Event(event));
    }
  }
}

async function signin() {
  await OnlineServices.createService(
    Services.prefs.getCharPref("onlineservices.defaultType", "google")
  );
  document.getElementById("services").className = "connected";
  buildEvents(OnlineServices.getServices());
  window.focus();
}

function openUrl(url) {
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

class KeyFrame extends HTMLElement {
  constructor(data) {
    super();
    this.data = data;
  }

  connectedCallback() {
    this.className = "keyframe card";

    let template = document.getElementById("template-keyframe");
    let fragment = template.content.cloneNode(true);
    fragment.querySelector(".favicon").src = this.data.icon;
    fragment.querySelector(".title").textContent = this.data.title;
    fragment.querySelector(".title").setAttribute("title", this.data.title);
    if (this.data.totalEngagement) {
      fragment.querySelector(".total-engagement").textContent = textForTime(
        this.data.totalEngagement
      );
    }
    if (this.data.lastVisit) {
      fragment.querySelector(".last-access").textContent = timeFormat.format(
        this.data.lastVisit
      );
    }

    this.appendChild(fragment);
    this.addEventListener("click", this);
  }

  handleEvent() {
    openUrl(this.data.url);
  }
}

customElements.define("e-keyframe", KeyFrame);

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

let cache = new Map();
async function getPlacesData(url) {
  let data = cache.get(url);
  if (data) {
    return data;
  }

  let query = NavHistory.getNewQuery();
  query.uri = Services.io.newURI(url);
  query.hasUri = true;

  let queryOptions = NavHistory.getNewQueryOptions();
  queryOptions.resultType = Ci.nsINavHistoryQueryOptions.RESULTS_AS_URI;
  queryOptions.maxResults = 1;

  let results = NavHistory.executeQuery(query, queryOptions);
  results.root.containerOpen = true;
  if (results.root.childCount < 1) {
    return null;
  }

  let result = results.root.getChild(0);
  data = {
    url,
    title: result.title,
    icon: await getFavicon(url, 16),
    richIcon: await getFavicon(url),
    previewImage: await getPreviewImageURL(url),
  };
  cache.set(url, data);
  return data;
}

async function updateList(id, frames) {
  if (!frames.length) {
    document.getElementById(id).setAttribute("hidden", "true");
    return;
  }
  document.getElementById(id).removeAttribute("hidden");

  let list = document.querySelector(`#${id} .keyframe-list`);

  frames.sort((a, b) => b.totalEngagement - a.totalEngagement);
  let nodes = [];

  for (let frame of frames) {
    let data = await getPlacesData(frame.url);
    if (!data) {
      continue;
    }
    if (data.previewImage) {
      data.richIcon = data.previewImage;
    }

    nodes.push(
      new KeyFrame({
        ...frame,
        ...data,
      })
    );
  }

  // Make sure to do this synchronously.
  list.replaceChildren([]);
  for (let node of nodes) {
    list.appendChild(node);
  }
}

let keyframes = [];
let documents = [];
function updateDisplay() {
  // Yes I know this is wrong in various cases.
  let yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  let cutoff = document.getElementById("range").valueAsNumber;
  document.getElementById("cutoff").textContent = `${cutoff / 1000} seconds`;

  let filterFrame = frame => {
    return frame.totalEngagement >= cutoff || frame.type == "manual";
  };

  let todayFrames = [];
  let yesterdayFrames = [];

  keyframes.filter(filterFrame).forEach(frame => {
    if (frame.lastVisit >= today) {
      todayFrames.push(frame);
    } else if (frame.lastVisit >= yesterday) {
      yesterdayFrames.push(frame);
    }
  });

  updateList("today", todayFrames);
  updateList("yesterday", yesterdayFrames);
  updateList("working", documents);
}

async function update() {
  // Yes I know this is wrong in various cases.
  let yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  keyframes = await Keyframes.queryAfter(yesterday.getTime());
  documents = await Keyframes.queryAfter(yesterday.getTime(), "document");

  updateDisplay();
}

let gBrowserInit = {
  delayedStartupFinished: true,
};
window.gBrowserInit = gBrowserInit;

function isInitialPage(url) {
  if (!(url instanceof Ci.nsIURI)) {
    try {
      url = Services.io.newURI(url);
    } catch (ex) {
      return false;
    }
  }

  if (url.spec == "about:blank") {
    return true;
  }
  return false;
}

function onLoad() {
  window.gURLBar = new UrlbarInput({
    textbox: document.getElementById("urlbar"),
    eventTelemetryCategory: "urlbar",
    isInitialPage,
    muxer: "companion",
  });

  update();
  Services.obs.addObserver(update, "keyframe-update");

  document.addEventListener("keydown", e => {
    if (e.key == "e" && e.metaKey) {
      let browserWindow = BrowserWindowTracker.getTopWindow();
      browserWindow?.focus();
    }
  });

  window.addEventListener("unload", onUnload, { once: true });

  let services = OnlineServices.getServices();
  if (services.length) {
    document.getElementById("services").className = "connected";
    buildEvents(services);
  } else {
    document.getElementById("services").className = "disconnected";
  }

  getTopSites();
}

function onUnload() {
  Services.obs.removeObserver(update, "keyframe-update");
}

window.addEventListener("load", onLoad, { once: true });

const NUM_TOPSITES = 5;

async function getTopSites() {
  let query = NavHistory.getNewQuery();
  // Two days of history
  query.beginTime = PlacesUtils.toPRTime(Date.now() - 2 * 24 * 60 * 60 * 1000);
  query.endTime == null;

  let queryOptions = NavHistory.getNewQueryOptions();
  queryOptions.resultType = Ci.nsINavHistoryQueryOptions.RESULTS_AS_URI;
  queryOptions.sortingMode =
    Ci.nsINavHistoryQueryOptions.SORT_BY_VISITCOUNT_DESCENDING;
  queryOptions.queryType = Ci.nsINavHistoryQueryOptions.QUERY_TYPE_HISTORY;

  let results = NavHistory.executeQuery(query, queryOptions);
  results.root.containerOpen = true;

  let frames = [];
  let domains = new Set();

  for (let i = 0; i < results.root.childCount; ++i) {
    let childNode = results.root.getChild(i);
    if (childNode.type == childNode.RESULT_TYPE_URI && childNode.title) {
      let frame = {};
      let uri = Services.io.newURI(childNode.uri);
      if (domains.has(uri.host)) {
        continue;
      }
      domains.add(uri.host);
      frame.url = childNode.uri;
      frame.lastVisit = childNode.time / 1000;
      frames.push(frame);
    }
    if (frames.length == NUM_TOPSITES) {
      break;
    }
  }

  updateList("topsites", frames);
}
