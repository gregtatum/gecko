/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["OnlineServices"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { DeferredTask } = ChromeUtils.import(
  "resource://gre/modules/DeferredTask.jsm"
);

const PREF_STORE = "onlineservices.config";

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  OAuth2: "resource:///modules/OAuth2.jsm",
  Services: "resource://gre/modules/Services.jsm",
  UtilityOverlay: "resource:///modules/UtilityOverlay.jsm",
  setInterval: "resource://gre/modules/Timer.jsm",
});

const PREF_LOGLEVEL = "browser.companion.loglevel";

const conferencingInfo = [
  {
    name: "Zoom",
    domain: "zoom.us",
    icon: "chrome://browser/content/companion/zoom.png",
  },
  {
    name: "Teams",
    domain: "teams.microsoft.com",
    icon: "chrome://browser/content/companion/teams.png",
  },
  {
    name: "Meet",
    domain: "meet.google.com",
    icon: "chrome://browser/content/companion/meet.png",
  },
  {
    name: "Jitsi",
    domain: "meet.jit.si",
    icon: "chrome://browser/content/companion/jitsi.png",
  },
  {
    name: "GoToMeeting",
    domain: ".gotomeeting.com",
    icon: "chrome://browser/content/companion/gotomeeting.png",
  },
  {
    name: "WebEx",
    domain: ".webex.com",
    icon: "chrome://browser/content/companion/webex.png",
  },
];

const URL_REGEX = /(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/gim;

XPCOMUtils.defineLazyGetter(this, "log", () => {
  let { ConsoleAPI } = ChromeUtils.import("resource://gre/modules/Console.jsm");
  return new ConsoleAPI({
    prefix: "OnlineServices.jsm",
    // tip: set maxLogLevel to "debug" and use log.debug() to create detailed
    // messages during development. See LOG_LEVELS in Console.jsm for details.
    maxLogLevel: "error",
    maxLogLevelPref: PREF_LOGLEVEL,
  });
});

Cu.importGlobalProperties(["fetch"]);

function getConferencingDetails(url) {
  try {
    url = new URL(url);
  } catch (e) {
    url = new URL(`https://${url}`);
  }

  let domainInfo = conferencingInfo.find(info =>
    url.host.endsWith(info.domain)
  );
  if (domainInfo) {
    return {
      icon: domainInfo.icon,
      name: domainInfo.name,
      url,
    };
  }
  return null;
}

/**
 * Parses a providers calendar event to get conferencing information.
 * Currently works with Google and Microsoft.
 * Only looks at conferencing data and location.
 * @param result Object Service specific response from server
 * @param links Array Links parsed out of the description
 * @returns { icon, name, url }
 */
function getConferenceInfo(result, links) {
  // conferenceData is a Google specific field
  if (result.conferenceData?.conferenceSolution) {
    let locationURL;

    for (let entry of result.conferenceData.entryPoints) {
      if (entry.uri.startsWith("https:")) {
        locationURL = new URL(entry.uri);
        break;
      }
    }

    let conferencingDetails = getConferencingDetails(locationURL);
    return (
      conferencingDetails || {
        icon: result.conferenceData.conferenceSolution.iconUri,
        name: result.conferenceData.conferenceSolution.name,
        url: locationURL,
      }
    );
  }
  // onlineMeeting is a Microsoft specific field
  if (result.onlineMeeting) {
    let locationURL = new URL(result.onlineMeeting.joinUrl);
    return getConferencingDetails(locationURL);
  }
  // Check to see if location contains a conferencing URL
  if (result.location) {
    try {
      let locationURL;
      if (result.location.displayName) {
        // Microsoft
        locationURL = new URL(result.location.displayName);
      } else {
        // Google
        locationURL = new URL(result.location);
      }
      return getConferencingDetails(locationURL);
    } catch (e) {
      // Location didn't contain a URL
    }
  }
  // If we didn't get any conferencing data in servert response, see if there
  // is a link in the document that has conferencing. We grab the first one.
  let conferenceLink = links.find(link => link.type == "conferencing");
  if (conferenceLink) {
    return getConferencingDetails(conferenceLink.url);
  }
  return null;
}

let linksToIgnore = ["https://aka.ms/JoinTeamsMeeting"];

async function processLink(url, text) {
  try {
    url = new URL(url);
  } catch (e) {
    // We might have URLS without protocols.
    // Just add http://
    url = new URL(`http://${url}`);
  }
  if (linksToIgnore.includes(url.href)) {
    return null;
  }
  // Tag conferencing URLs in case we need them,but just return.
  if (conferencingInfo.find(info => url.host.endsWith(info.domain))) {
    return {
      url: url.href,
      type: "conferencing",
    };
  }
  let link = {};
  link.url = url.href;
  if ((!text && text != "") || url.href == text) {
    if (url.host === "docs.google.com" || url.host === "drive.google.com") {
      for (let service of ServiceInstances) {
        if (service.app.startsWith("google")) {
          let documentName = await service.getTitle(url.href);
          if (documentName) {
            link.text = documentName;
          }
        }
      }
    }
  } else {
    link.text = text;
  }
  return link;
}

async function getLinkInfo(result) {
  let doc;
  let links = [];
  let parser = new DOMParser();
  let description;
  if ("body" in result) {
    // This is Microsoft specific
    description = result.body.content;
  } else {
    description = result.description;
  }
  // Descriptions from both providers use HTML entities in some URLs.
  // The only one that truly affects us is &amp;
  // We also remove wordbreak tags as Google inserts them in URLs.
  description = description?.replace(/&amp;/g, "&").replace(/<wbr>/g, "");
  doc = parser.parseFromString(description, "text/html");
  let anchors = doc.getElementsByTagName("a");
  if (anchors.length) {
    for (let anchor of anchors) {
      let link = await processLink(anchor.href, anchor.textContent);
      if (link) {
        links.push(link);
      }
    }
  }
  let descriptionLinks = description?.match(URL_REGEX);
  if (descriptionLinks?.length) {
    for (let descriptionLink of descriptionLinks) {
      // Need to normalize these URLs so they match
      // the URLs from processLink
      let descriptionURL = new URL(descriptionLink);
      if (
        links.some(
          link =>
            link.url == descriptionURL.href || link.text == descriptionLink
        )
      ) {
        continue;
      }
      let link = await processLink(descriptionLink);
      if (link) {
        links.push(link);
      }
    }
  }
  return links.filter(link => link.text !== "");
}

async function openLink(url) {
  for (let window of BrowserWindowTracker.orderedWindows) {
    for (let browser of window.gBrowser.browsers) {
      try {
        if (browser.currentURI.hostPort == url.host) {
          window.gBrowser.selectedTab = window.gBrowser.getTabForBrowser(
            browser
          );
          browser.loadURI(url, {
            triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
          });
          return;
        }
      } catch (e) {
        // Bad hostPort.
      }
    }
  }

  let win = BrowserWindowTracker.getTopWindow({
    allowPopups: false,
  });

  if (win) {
    win.switchToTabHavingURI(url, true, {
      ignoreFragment: true,
    });
  }

  UtilityOverlay.openTrustedLinkIn(url.href, "tab");
}

var nextServiceId = 0;

class GoogleService {
  constructor(config) {
    this.name = "Google";
    this.app = config.type;
    this.id = ++nextServiceId;

    let scopes = [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      "https://www.googleapis.com/auth/drive.readonly",
    ];

    this.auth = new OAuth2(
      services[this.app].endpoint,
      services[this.app].tokenEndpoint,
      scopes.join(" "),
      services[this.app].clientId,
      services[this.app].clientSecret,
      config?.auth
    );
    this.getUnreadCountAtom();
    this.mailCountTimer = setInterval(
      this.getUnreadCountAtom.bind(this),
      60 * 1000
    );
  }

  async connect() {
    // This will force login if not already logged in.
    let token = await this.getToken();
    return token;
  }

  async disconnect() {
    let token = await this.getToken();

    // revoke access for the current stoken stored
    let apiTarget = new URL(
      `https://oauth2.googleapis.com/revoke?token=${token}`
    );
    let headers = {
      "Content-type": "application/x-www-form-urlencoded",
    };

    let response = await fetch(apiTarget, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }
  }

  async getToken() {
    let token = await this.auth.getToken();
    if (token) {
      OnlineServices.persist();
    }
    return token;
  }

  async getAccountAddress() {
    return this.emailAddress;
  }

  openCalendar(event) {
    openLink(new URL(event.url));
  }

  async getNextMeetings() {
    let token = await this.getToken();

    let apiTarget = new URL(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList"
    );

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let calendarList = [];

    if (!response.ok) {
      calendarList.push({
        id: "primary",
      });
    } else {
      let results = await response.json();
      log.debug(JSON.stringify(results));
      for (let result of results.items) {
        if (result.hidden || !result.selected) {
          continue;
        }
        let calendar = {};
        calendar.id = result.primary ? "primary" : result.id;
        // The ID of the primary calendar is the user's email
        // address. By storing it here, we don't need extra
        // auth scopes.
        if (result.primary) {
          this.emailAddress = result.id;
        }
        calendar.backgroundColor = result.backgroundColor;
        calendar.foregroundColor = result.foregroundColor;
        calendarList.push(calendar);
      }
    }

    let allEvents = new Map();
    for (let calendar of calendarList) {
      apiTarget = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendar.id
        )}/events`
      );

      apiTarget.searchParams.set("orderBy", "startTime");
      apiTarget.searchParams.set("singleEvents", "true");
      let dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      apiTarget.searchParams.set("timeMin", dayStart.toISOString());
      // If we want to reduce the window, we can just make
      // timeMax an hour from now.
      let midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      apiTarget.searchParams.set("timeMax", midnight.toISOString());

      headers = {
        Authorization: `Bearer ${token}`,
      };

      response = await fetch(apiTarget, {
        headers,
      });

      if (!response.ok) {
        log.debug(response.statusText);
        continue;
      }

      let results = await response.json();

      log.debug(JSON.stringify(results));

      for (let result of results.items) {
        try {
          // Ignore all day events
          if (!result.start?.dateTime || !result.end?.dateTime) {
            continue;
          }
          if (
            calendar.id == "primary" &&
            result.attendees &&
            !result.attendees.filter(
              attendee =>
                attendee.self === true && attendee.responseStatus === "accepted"
            ).length
          ) {
            continue;
          }
          let event = {};
          event.summary = result.summary;
          event.start = new Date(result.start.dateTime);
          event.end = new Date(result.end.dateTime);
          let links = await getLinkInfo(result);
          event.conference = getConferenceInfo(result, links);
          event.links = links.filter(link => link.type != "conferencing");
          event.calendar = {};
          event.calendar.id = calendar.id;
          event.attendees = result.attendees?.filter(a => !a.self) || [];
          event.organizer = result.organizer;
          event.creator = result.creator;
          event.serviceId = this.id;
          event.url = result.htmlLink;
          if (allEvents.has(result.id)) {
            // If an event is duplicated, use
            // the primary calendar
            if (calendar.id == "primary") {
              allEvents.set(result.id, event);
            }
          } else {
            allEvents.set(result.id, event);
          }
        } catch (e) {
          log.error(e);
        }
      }
    }
    return Array.from(allEvents.values()).sort((a, b) => {
      if (a.start.getTime() == b.start.getTime()) {
        return a.end - a.start - (b.end - b.start);
      }
      return a.start - b.start;
    });
  }

  openEmail(messageData) {
    if ("link" in messageData) {
      openLink(new URL(messageData.link));
    } else {
      openLink(
        new URL(`https://mail.google.com/mail/#inbox/${messageData.id}`)
      );
    }
  }

  async getEmailInfo(messageId) {
    let token = await this.getToken();

    let apiTarget = new URL(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`
    );

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    let results = await response.json();

    log.debug(JSON.stringify(results));

    return {
      id: results.id,
      subject: results.payload.headers.find(
        header => header.name.toLowerCase() == "subject"
      )?.value,
      from: results.payload.headers.find(
        header => header.name.toLowerCase() == "from"
      )?.value,
      date: new Date(parseInt(results.internalDate)),
      snippet: results.snippet,
    };
  }

  async getUnreadEmail() {
    let token = await this.getToken();

    let apiTarget = new URL(
      "https://www.googleapis.com/gmail/v1/users/me/messages"
    );

    apiTarget.searchParams.set("q", "is:unread in:inbox");
    apiTarget.searchParams.set("maxResults", 3);

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }

    let results = await response.json();
    log.debug(JSON.stringify(results));

    let messages = [];

    if ("messages" in results) {
      for (const message of results.messages) {
        let result = await this.getEmailInfo(message.id);
        messages.push(result);
      }
    }
    return messages;
  }

  async getUnreadEmailAtom() {
    let response = await fetch("https://mail.google.com/mail/u/0/feed/atom");

    if (!response.ok) {
      if (response.status == 403) {
        // Atom feed won't work unless we've navigated to the inbox
        UtilityOverlay.openTrustedLinkIn(
          "https://mail.google.com/mail/u/0/ =",
          "tab"
        );
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

  async getUnreadCountAtom() {
    let response = await fetch("https://mail.google.com/mail/u/0/feed/atom");

    if (!response.ok) {
      this.mailCount = 0;
      return;
    }

    let results = await response.text();

    let doc = new DOMParser().parseFromString(results, "text/xml");

    this.mailCount = parseInt(doc.querySelector("fullcount").textContent);
  }

  async getTitle(url) {
    url = new URL(url);
    if (!url.hostname.endsWith(".google.com")) {
      return null;
    }
    let id = url.href.split("/")[5];
    let type = url.href.split("/")[3];
    if (!id || !type) {
      return null;
    }
    let apiTarget;
    switch (type) {
      case "document":
        apiTarget = new URL(`https://docs.googleapis.com/v1/documents/${id}`);
        break;
      case "spreadsheets":
        apiTarget = new URL(
          `https://sheets.googleapis.com/v4/spreadsheets/${id}`
        );
        break;
      case "presentation":
        apiTarget = new URL(
          `https://slides.googleapis.com/v1/presentations/${id}`
        );
        break;
      case "drive":
      case "file":
        apiTarget = new URL(`https://www.googleapis.com/drive/v2/files/${id}`);
        break;
      default:
        return null;
    }
    let token = await this.getToken();
    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();

    if (results.error) {
      return null;
    }

    log.debug(JSON.stringify(results));

    if (type == "spreadsheets") {
      return results.properties.title;
    }

    return results.title;
  }

  toJSON() {
    return {
      type: this.app,
      auth: this.auth,
    };
  }
}

class MicrosoftService {
  constructor(config) {
    this.name = "Microsoft";
    this.app = config.type;
    this.id = ++nextServiceId;

    let scopes = [
      // This is required or we don't get a refreshToken
      "offline_access",
      "https://graph.microsoft.com/Calendars.Read",
      "https://graph.microsoft.com/Mail.Read",
    ];

    this.auth = new OAuth2(
      services[this.app].endpoint,
      services[this.app].tokenEndpoint,
      scopes.join(" "),
      services[this.app].clientId,
      services[this.app].clientSecret,
      config?.auth
    );
    this.getUnreadCount();
    this.mailCountTimer = setInterval(
      this.getUnreadCount.bind(this),
      60 * 1000
    );
    this.getInboxURL();
  }

  async connect() {
    // This will force login if not already logged in.
    let token = await this.getToken();
    return token;
  }

  async disconnect() {
    // Unfortunately none of the documented methods
    // for revoking tokens are working with Microsoft,
    // so I'm punting for now.
    /*
    let token = await this.getToken();

    // revoke access for the current stoken stored
    let apiTarget = new URL(
      `https://graph.microsoft.com/v1.0/me/revokeSignInSessions`
    );
    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }
    */
  }

  async getToken() {
    let token = await this.auth.getToken();
    if (token) {
      OnlineServices.persist();
    }
    return token;
  }

  openCalendar(event) {
    openLink(new URL(event.url));
  }

  async getNextMeetings() {
    let token = await this.getToken();

    let apiTarget = new URL("https://graph.microsoft.com/v1.0/me/calendars");

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();
    log.debug(JSON.stringify(results));

    if (results.error) {
      log.error(results.error.message);
      return [];
    }

    let calendarList = [];
    for (let result of results.value) {
      let calendar = {};
      calendar.id = result.id;
      calendarList.push(calendar);
    }

    let dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    // If we want to reduce the window, we can just make
    // timeMax an hour from now.
    let midnight = new Date();
    midnight.setHours(24, 0, 0, 0);

    let allEvents = new Map();
    for (let calendar of calendarList) {
      apiTarget = new URL(
        `https://graph.microsoft.com/v1.0/me/calendars/${
          calendar.id
        }/events?orderby=start/dateTime&$filter=start/dateTime ge '${dayStart.toISOString()}' AND start/dateTime le '${midnight.toISOString()}'`
      );

      response = await fetch(apiTarget, {
        headers,
      });

      results = await response.json();
      log.debug(JSON.stringify(results));

      if (results.error) {
        log.error(results.error.message);
        continue;
      }

      for (let result of results.value) {
        try {
          // Ignore all day events
          if (result.isAllDay) {
            continue;
          }
          let event = {};
          event.summary = result.subject;
          event.start = new Date(result.start.dateTime + "Z");
          event.end = new Date(result.end.dateTime + "Z");
          let links = await getLinkInfo(result);
          event.conference = getConferenceInfo(result, links);
          event.links = links.filter(link => link.type != "conferencing");
          event.calendar = {};
          event.calendar.id = calendar.id;
          event.serviceId = this.id;
          event.url = result.webLink;

          event.creator = null; // No creator seems to be available.
          event.organizer = this._normalizeUser(result.organizer, {
            self: result.isOrganizer,
          });
          event.attendees = result.attendees.map(a => this._normalizeUser(a));
          allEvents.set(result.id, event);
        } catch (e) {
          log.error(e);
        }
      }
    }
    return Array.from(allEvents.values()).sort((a, b) => a.start - b.start);
  }

  async getInboxURL() {
    // Hacky, buy I can't find anyway to get the inbox URL
    // without looking at an email.
    if (!this.inboxURL) {
      let token = await this.getToken();

      let apiTarget = new URL(
        "https://graph.microsoft.com/v1.0/me/messages?$top=1&$select=webLink"
      );

      let headers = {
        Authorization: `Bearer ${token}`,
      };

      let response = await fetch(apiTarget, {
        headers,
      });

      let results = await response.json();
      log.debug(JSON.stringify(results));

      if (results.error) {
        log.error(results.error.message);
      }
      if (results.error || !results.value?.length) {
        this.inboxURL = "https://outlook.com";
      } else {
        this.inboxURL = results.value[0].webLink.split("?")[0];
      }
    }
  }

  async getUnreadCount() {
    let token = await this.getToken();

    // By just selecting the ID, we're getting as little data as we need.
    // I couldn't find a way to just get the count.
    let apiTarget = new URL(
      "https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=isRead ne true&$count=true&$select=id"
    );

    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();
    log.debug(JSON.stringify(results));

    if (results.error) {
      log.error(results.error.message);
      this.mailCount = 0;
    }
    this.mailCount = results["@odata.count"];
  }

  _normalizeUser(user, { self } = {}) {
    return {
      email: user.emailAddress.address,
      name: user.emailAddress.name,
      self: !!self,
    };
  }

  toJSON() {
    return {
      type: this.app,
      auth: this.auth,
    };
  }
}

const ServiceInstances = new Set();

let loaded = false;
function load() {
  if (loaded) {
    return;
  }
  loaded = true;

  let config = JSON.parse(Services.prefs.getCharPref(PREF_STORE, "[]"));

  for (let service of config) {
    // In the past, services could have null auth due to a bug.
    if (!service.auth) {
      continue;
    }
    if (service.type.startsWith("google")) {
      ServiceInstances.add(new GoogleService(service));
    } else if (service.type.startsWith("microsoft")) {
      ServiceInstances.add(new MicrosoftService(service));
    }
  }
}

let services = {
  google: {
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId:
      "290111995646-hrdpn27kp4jl0r6gej8540cg3cc4i0g6.apps.googleusercontent.com",
    clientSecret: "mjlcpD5iiSNABCq_3PRtUglS",
  },
  "google-mozilla": {
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId:
      "913967847322-m8ij544g2i23pssvchhru1hceg08irud.apps.googleusercontent.com",
    clientSecret: "G7bg5a1bahnVWxd6GKQcO4Ro",
  },
  "google-mozilla-test": {
    endpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
    clientId:
      "1008059134576-ki9j8bfsrdho6ot9aun1mjljoegch6pn.apps.googleusercontent.com",
    clientSecret: "jraQ3WNSCLK6g7uVKQd3PwUX",
  },
  microsoft: {
    endpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: "66d9891f-d284-4158-a9b3-27aebf6b0f8c",
    clientSecret: "P8_.eMal60dY1VFEU1K6N_-22o4cA6vo.d",
  },
};

const OnlineServices = {
  lastAccess: new Date("1999-12-31"),
  data: null,
  freshnessMs: 5 * 60 * 1000,

  get isFresh() {
    let now = new Date();
    return now - this.lastAccess < this.freshnessMs;
  },

  async createService(type) {
    load();

    let service;
    if (type.startsWith("google")) {
      service = new GoogleService({ type });
    } else if (type.startsWith("microsoft")) {
      service = new MicrosoftService({ type });
    }
    let token = await service.connect();
    if (!token) {
      return null;
    }
    ServiceInstances.add(service);
    this.persist();
    return service;
  },

  findServiceById(id) {
    for (let service of ServiceInstances) {
      if (service.id == id) {
        return service;
      }
    }
    return null;
  },

  async deleteService(service) {
    await service.disconnect();
    ServiceInstances.delete(service);
    this.persist();
  },

  getMailCount(type) {
    let mailCount = 0;
    for (let service of ServiceInstances) {
      if (service.app.startsWith(type)) {
        mailCount += service.mailCount;
      }
    }
    return mailCount;
  },

  getInboxURL(type) {
    for (let service of ServiceInstances) {
      if (service.app.startsWith(type)) {
        return service.inboxURL;
      }
    }
    return null;
  },

  getServices() {
    load();

    return [...ServiceInstances];
  },

  persist() {
    let config = JSON.stringify(Array.from(ServiceInstances));
    Services.prefs.setCharPref(PREF_STORE, config);
  },

  refreshEvents() {
    if (!this._refreshCompletePromise) {
      this._refreshCompletePromise = new Promise(resolve => {
        this._promiseRefresh = resolve;
        Services.obs.notifyObservers(null, "companion-services-refresh");
      }).finally(() => {
        this._refreshCompletePromise = null;
      });
    }
    return this._refreshCompletePromise;
  },

  setCache(data) {
    this.data = data;
    this.lastAccess = new Date();
  },

  getCache() {
    return this.data;
  },

  async getEvents() {
    return this.isFresh ? this.getCache() : this.fetchEvents();
  },

  async fetchEvents() {
    let servicesData = this.getServices();
    if (!servicesData.length) {
      if (this._promiseRefresh) {
        this._promiseRefresh();
        this._promiseRefresh = null;
      }
      return [];
    }

    let meetingResults = new Array(servicesData.length);
    let i = 0;
    for (let service of servicesData) {
      meetingResults[i] = service.getNextMeetings();
      i++;
    }

    let eventResults = await Promise.allSettled(meetingResults);
    let events = eventResults.flatMap(r => r.value || []);

    this.setCache(events);

    if (this._promiseRefresh) {
      this._promiseRefresh();
      this._promiseRefresh = null;
    }

    // Reset the auto refresh task to its full refresh time. This will also
    // queue the first auto-refresh if this is the first time we load events.
    refreshEventsTask.disarm();
    refreshEventsTask.arm();

    return events;
  },
};

// This task will be armed after the events are retrieved for the first time.
const refreshEventsTask = new DeferredTask(async () => {
  try {
    await OnlineServices.refreshEvents();
  } catch (e) {
    Cu.reportError(e);
  } finally {
    // Just don't throw, fetchEvents() will have re-armed the task.
  }
}, OnlineServices.freshnessMs);
