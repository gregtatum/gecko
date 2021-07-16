/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */
const EXPORTED_SYMBOLS = ["OnlineServices"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);

const PREF_STORE = "onlineservices.config";

XPCOMUtils.defineLazyModuleGetters(this, {
  BrowserWindowTracker: "resource:///modules/BrowserWindowTracker.jsm",
  OAuth2: "resource:///modules/OAuth2.jsm",
  Services: "resource://gre/modules/Services.jsm",
  UtilityOverlay: "resource:///modules/UtilityOverlay.jsm",
});

const PREF_LOGLEVEL = "browser.companion.loglevel";

const conferencingInfo = [
  {
    name: "Zoom Meeting",
    domain: ".zoom.us",
    icon: "chrome://browser/content/companion/zoom.png",
  },
  {
    name: "Microsoft Teams",
    domain: "teams.microsoft.com",
    icon: "chrome://browser/content/companion/teams.png",
  },
  {
    name: "Google Meet",
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

function getConferenceInfo(result) {
  // conferenceData is a Google specific field
  if (result.conferenceData?.conferenceSolution) {
    let base = {
      icon: result.conferenceData.conferenceSolution.iconUri,
      name: result.conferenceData.conferenceSolution.name,
    };

    for (let entry of result.conferenceData.entryPoints) {
      if (entry.uri.startsWith("https:")) {
        return {
          ...base,
          url: entry.uri,
        };
      }
    }
  }
  // onlineMeeting is a Google specific field
  if (result.onlineMeeting) {
    let locationURL = new URL(result.onlineMeeting.joinUrl);
    return getConferencingDetails(locationURL);
  }
  if (result.location) {
    try {
      let locationURL = new URL(result.location);
      return getConferencingDetails(locationURL);
    } catch (e) {}
  }
  // We are parsing the description twice, once for conferencing
  // and once for links. We can probably do better.
  if (result.description) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(result.description, "text/html");
    let anchors = doc.getElementsByTagName("a");
    if (anchors.length) {
      for (let anchor of anchors) {
        let conferencingDetails = getConferencingDetails(anchor.href);
        if (conferencingDetails) {
          return conferencingDetails;
        }
      }
    } else if (result.description) {
      let descriptionLinks = result.description.match(URL_REGEX);
      if (descriptionLinks?.length) {
        for (let descriptionLink of descriptionLinks) {
          let conferencingDetails = getConferencingDetails(descriptionLink);
          if (conferencingDetails) {
            return conferencingDetails;
          }
        }
      }
    }
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
  // We already handled conferencing URLs separately
  if (conferencingInfo.find(info => url.host.endsWith(info.domain))) {
    return null;
  }
  if (linksToIgnore.includes(url.href)) {
    return null;
  }
  let link = {};
  link.url = url.href;
  if (!text || url.href == text) {
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
  if ("body" in result) {
    // This is Microsoft specific
    doc = parser.parseFromString(result.body.content, "text/html");
  } else {
    // This is Google specific
    doc = parser.parseFromString(result.description, "text/html");
  }
  let anchors = doc.getElementsByTagName("a");
  if (anchors.length) {
    for (let anchor of anchors) {
      let link = await processLink(anchor.href, anchor.textContent);
      if (link) {
        links.push(link);
      }
    }
  } else if (result.description) {
    let descriptionLinks = result.description.match(URL_REGEX);
    if (descriptionLinks?.length) {
      for (let descriptionLink of descriptionLinks) {
        let link = await processLink(descriptionLink);
        if (link) {
          links.push(link);
        }
      }
    }
  }
  return links;
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
    let start = new Date(event.start);
    openLink(
      new URL(
        `https://calendar.google.com/calendar/u/${
          this.emailAddress
        }/r/day/${start.getFullYear()}/${start.getMonth() +
          1}/${start.getDate()}`
      )
    );
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
        event.conference = getConferenceInfo(result);
        event.links = await getLinkInfo(result);
        event.calendar = {};
        event.calendar.id = calendar.id;
        event.attendees = result.attendees?.filter(a => !a.self) || [];
        event.organizer = result.organizer;
        event.creator = result.creator;
        if (allEvents.has(result.id)) {
          // If an event is duplicated, use
          // the primary calendar
          if (calendar.id == "primary") {
            allEvents.set(result.id, event);
          }
        } else {
          allEvents.set(result.id, event);
        }
        event.serviceId = this.id;
      }
    }
    return Array.from(allEvents.values()).sort((a, b) => a.start - b.start);
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

  async getTitle(url) {
    url = new URL(url);
    if (!url.hostname.endsWith(".google.com")) {
      return null;
    }
    let id = url.href.split("/")[5];
    let type = url.href.split("/")[3];
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
      case "file":
        apiTarget = new URL(`https://www.googleapis.com/drive/v2/files/${id}`);
        break;
    }

    let token = await this.getToken();
    let headers = {
      Authorization: `Bearer ${token}`,
    };

    let response = await fetch(apiTarget, {
      headers,
    });

    let results = await response.json();

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
    ];

    this.auth = new OAuth2(
      services[this.app].endpoint,
      services[this.app].tokenEndpoint,
      scopes.join(" "),
      services[this.app].clientId,
      services[this.app].clientSecret,
      config?.auth
    );
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

    let dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    // If we want to reduce the window, we can just make
    // timeMax an hour from now.
    let midnight = new Date();
    midnight.setHours(24, 0, 0, 0);

    let apiTarget = new URL(
      `https://graph.microsoft.com/v1.0/me/calendar/events?orderby=start/dateTime&$filter=start/dateTime ge '${dayStart.toISOString()}' AND start/dateTime le '${midnight.toISOString()}'`
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

    let allEvents = new Map();
    for (let result of results.value) {
      // Ignore all day events
      if (result.isAllDay) {
        continue;
      }
      let event = {};
      event.summary = result.subject;
      event.start = new Date(result.start.dateTime + "Z");
      event.end = new Date(result.end.dateTime + "Z");
      event.conference = getConferenceInfo(result);
      event.links = await getLinkInfo(result);
      //      event.calendar = {};
      //      event.calendar.id = calendar.id;
      allEvents.set(result.id, event);
      event.serviceId = this.id;
      event.url = result.webLink;

      event.creator = null; // No creator seems to be available.
      event.organizer = this._normalizeUser(result.organizer, {
        self: result.isOrganizer,
      });
      event.attendees = result.attendees.map(a => this._normalizeUser(a));
    }
    return Array.from(allEvents.values()).sort((a, b) => a.start - b.start);
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

  getServices() {
    load();

    return [...ServiceInstances];
  },

  persist() {
    let config = JSON.stringify(Array.from(ServiceInstances));
    Services.prefs.setCharPref(PREF_STORE, config);
  },
};
